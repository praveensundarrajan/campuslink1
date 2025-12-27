import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  addDoc,
  query,
  where,
  orderBy,
  limit,
  serverTimestamp,
  onSnapshot,
  deleteDoc
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from './firebase';
import { moderateContent, categorizeIssue, calculateMentorMatch } from './gemini';

/**
 * PROFILES
 */

/**
 * Check if profile is complete
 */
export function isProfileComplete(profile) {
  if (!profile) return false;

  return !!(
    profile.department &&
    profile.year &&
    profile.bio &&
    (profile.skillsHave && profile.skillsHave.length > 0) &&
    (profile.skillsToLearn && profile.skillsToLearn.length > 0)
  );
}

export async function createProfile(userId, profileData) {
  const moderation = await moderateContent(profileData.bio, 'profile');

  if (!moderation.safe) {
    throw new Error(`Profile bio rejected: ${moderation.reason}`);
  }

  const profile = {
    userId,
    department: profileData.department,
    year: profileData.year,
    // Use correct field names from requirements
    skillsHave: profileData.skillsHave || profileData.skillsOffered || [],
    skillsToLearn: profileData.skillsToLearn || profileData.skillsWanted || [],
    bio: profileData.bio,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  };

  await setDoc(doc(db, 'profiles', userId), profile);

  // Update user document with profile completion status
  await setDoc(doc(db, 'users', userId), {
    profileComplete: true,
    role: 'user'
  }, { merge: true });

  return profile;
}

export async function getProfile(userId) {
  const profileDoc = await getDoc(doc(db, 'profiles', userId));
  return profileDoc.exists() ? { id: profileDoc.id, ...profileDoc.data() } : null;
}

export async function updateProfile(userId, updates) {
  if (updates.bio) {
    const moderation = await moderateContent(updates.bio, 'profile');
    if (!moderation.safe) {
      throw new Error(`Bio rejected: ${moderation.reason}`);
    }
  }

  await updateDoc(doc(db, 'profiles', userId), {
    ...updates,
    updatedAt: serverTimestamp()
  });
}

/**
 * ISSUES
 */

export async function createIssue(issueData, imageFile = null) {
  console.log('[DB] Creating issue...');
  console.log('[DB] Image file:', imageFile ? `${imageFile.name} (${imageFile.size} bytes)` : 'none');

  // Moderate issue description
  try {
    const moderation = await moderateContent(issueData.description, 'issue');

    if (!moderation.safe) {
      throw new Error(`Issue rejected: ${moderation.reason}`);
    }
  } catch (moderationError) {
    console.warn('[DB] Moderation failed, allowing issue:', moderationError.message);
    // Continue even if moderation fails
  }

  // Categorize and prioritize using AI
  let categorization = { category: issueData.category, priority: 'Medium', tags: [], summary: '' };
  try {
    categorization = await categorizeIssue(issueData.description);
  } catch (categorizationError) {
    console.warn('[DB] Categorization failed, using defaults:', categorizationError.message);
  }

  let imageUrl = null;
  if (imageFile) {
    try {
      console.log('[DB] Uploading image to Firebase Storage...');
      const fileName = `${Date.now()}_${imageFile.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
      const storageRef = ref(storage, `issues/${fileName}`);

      console.log('[DB] Storage path:', `issues/${fileName}`);
      const uploadResult = await uploadBytes(storageRef, imageFile);
      console.log('[DB] ✅ Upload successful, getting download URL...');

      imageUrl = await getDownloadURL(uploadResult.ref);
      console.log('[DB] ✅ Image URL:', imageUrl);
    } catch (uploadError) {
      console.error('[DB] ❌ Image upload failed:', uploadError);
      console.error('[DB] Error code:', uploadError.code);
      console.error('[DB] Error message:', uploadError.message);

      // Don't fail the entire issue creation if image upload fails
      // Just log the error and continue without image
      console.warn('[DB] Continuing without image...');
    }
  }

  const issue = {
    category: issueData.category || categorization.category,
    description: issueData.description,
    imageUrl,
    isAnonymous: issueData.isAnonymous || false,
    reportedBy: issueData.isAnonymous ? null : issueData.userId,
    status: 'Open',
    priority: categorization.priority,
    tags: categorization.tags || [],
    summary: categorization.summary || '',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    statusHistory: [{
      status: 'Open',
      timestamp: new Date().toISOString(),
      note: 'Issue reported'
    }]
  };

  console.log('[DB] Creating issue document...');
  const docRef = await addDoc(collection(db, 'issues'), issue);
  console.log('[DB] ✅ Issue created:', docRef.id);

  return { id: docRef.id, ...issue };
}

export async function getIssues(filters = {}) {
  let q = collection(db, 'issues');
  const constraints = [];

  // Apply filters FIRST
  if (filters.category) {
    constraints.push(where('category', '==', filters.category));
  }

  if (filters.status) {
    constraints.push(where('status', '==', filters.status));
  }

  if (filters.priority) {
    constraints.push(where('priority', '==', filters.priority));
  }

  if (filters.userId) {
    constraints.push(where('reportedBy', '==', filters.userId));
  }

  // CRITICAL FIX: Only apply database-level sorting if we are NOT filtering
  // This avoids "Missing Index" errors during the hackathon demo.
  // We will sort in memory instead.
  if (constraints.length === 0) {
    constraints.push(orderBy('createdAt', 'desc'));
  }

  if (filters.limit) {
    constraints.push(limit(filters.limit));
  }

  q = query(q, ...constraints);

  const snapshot = await getDocs(q);
  const results = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

  // Always sort in memory to be safe (Anti-Gravity Reliability)
  return results.sort((a, b) => {
    const timeA = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
    const timeB = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
    return timeB - timeA; // Descending (newest first)
  });
}

export async function updateIssueStatus(issueId, newStatus, note, adminEmail) {
  const issueRef = doc(db, 'issues', issueId);
  const issueDoc = await getDoc(issueRef);

  if (!issueDoc.exists()) {
    throw new Error('Issue not found');
  }

  const issue = issueDoc.data();
  const statusHistory = issue.statusHistory || [];

  statusHistory.push({
    status: newStatus,
    timestamp: new Date().toISOString(),
    note: note || '',
    updatedBy: adminEmail
  });

  await updateDoc(issueRef, {
    status: newStatus,
    statusHistory,
    updatedAt: serverTimestamp()
  });
}

export function subscribeToIssues(callback, filters = {}) {
  let q = collection(db, 'issues');

  const constraints = [orderBy('createdAt', 'desc'), limit(50)];

  if (filters.category) {
    constraints.unshift(where('category', '==', filters.category));
  }

  q = query(q, ...constraints);

  return onSnapshot(q, (snapshot) => {
    const issues = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    callback(issues);
  });
}

/**
 * MENTOR DISCOVERY - FIXED
 */

/**
 * Normalize a skill string for matching
 */
function normalizeSkill(skill) {
  return skill.toLowerCase().trim().replace(/[^a-z0-9\s]/g, '');
}

/**
 * Check if two skills match (exact or partial)
 */
function skillsMatch(skill1, skill2) {
  const norm1 = normalizeSkill(skill1);
  const norm2 = normalizeSkill(skill2);

  // Exact match
  if (norm1 === norm2) return true;

  // Partial match (one contains the other)
  if (norm1.includes(norm2) || norm2.includes(norm1)) return true;

  // Word overlap (e.g., "machine learning" matches "learning")
  const words1 = norm1.split(/\s+/);
  const words2 = norm2.split(/\s+/);

  return words1.some(w1 => words2.some(w2 => w1 === w2 || w1.includes(w2) || w2.includes(w1)));
}

/**
 * Calculate match score between learner's wanted skills and mentor's skills
 */
function calculateLocalMatchScore(learnerWants, mentorHas) {
  if (!learnerWants || !mentorHas || learnerWants.length === 0 || mentorHas.length === 0) {
    return { score: 0, matchedSkills: [] };
  }

  const matchedSkills = [];
  let matchCount = 0;

  for (const wantedSkill of learnerWants) {
    for (const hasSkill of mentorHas) {
      if (skillsMatch(wantedSkill, hasSkill)) {
        matchedSkills.push(hasSkill);
        matchCount++;
        break; // Count each wanted skill only once
      }
    }
  }

  // Calculate score: (matched / wanted) * 100
  const score = Math.round((matchCount / learnerWants.length) * 100);

  return {
    score,
    matchedSkills: [...new Set(matchedSkills)] // Remove duplicates
  };
}

/**
 * Generate match reason text
 */
function generateMatchReason(learnerWants, matchedSkills, mentorName = 'This mentor') {
  if (matchedSkills.length === 0) {
    return `${mentorName} has relevant experience that may help you.`;
  }

  const skillList = matchedSkills.slice(0, 3).join(', ');
  const remaining = matchedSkills.length - 3;

  if (matchedSkills.length === 1) {
    return `You want to learn ${learnerWants[0]}. ${mentorName} has experience in ${skillList}.`;
  } else if (matchedSkills.length <= 3) {
    return `You want to learn ${learnerWants.slice(0, 2).join(' and ')}. ${mentorName} can teach ${skillList}.`;
  } else {
    return `You want to learn ${learnerWants[0]} and more. ${mentorName} can teach ${skillList} and ${remaining} other skills.`;
  }
}

export async function searchMentors(currentUserId, searchQuery, searchSkills) {
  try {
    // Get current user's profile
    const currentProfile = await getProfile(currentUserId);
    if (!currentProfile) {
      console.error('Current user profile not found');
      return [];
    }

    // Determine what skills to search for
    let skillsToMatch = searchSkills || currentProfile.skillsToLearn || currentProfile.skillsWanted || [];

    // If search query provided, parse it
    if (searchQuery && searchQuery.trim()) {
      // Split by common delimiters
      const parsedSkills = searchQuery
        .split(/[,;]/)
        .map(s => s.trim())
        .filter(s => s.length > 0);

      if (parsedSkills.length > 0) {
        skillsToMatch = parsedSkills;
      }
    }

    if (skillsToMatch.length === 0) {
      console.warn('No skills to match against');
      return [];
    }

    // Get all profiles except current user
    const q = query(collection(db, 'profiles'));
    const snapshot = await getDocs(q);

    const profiles = snapshot.docs
      .map(doc => ({ id: doc.id, ...doc.data() }))
      .filter(profile => profile.userId !== currentUserId)
      .filter(profile => profile.skillsHave && profile.skillsHave.length > 0); // Only mentors with skills

    if (profiles.length === 0) {
      console.warn('No other user profiles found');
      return [];
    }

    // Calculate match scores for each profile
    const mentorsWithScores = profiles.map(mentor => {
      // Support both old field names and new ones
      const mentorSkills = mentor.skillsHave || mentor.skillsOffered || [];

      const { score, matchedSkills } = calculateLocalMatchScore(skillsToMatch, mentorSkills);

      const matchReason = generateMatchReason(skillsToMatch, matchedSkills);

      return {
        ...mentor,
        matchScore: score,
        matchReason: matchReason,
        matchedSkills: matchedSkills,
        // Ensure consistent field names in output
        skillsHave: mentorSkills,
        skillsToLearn: mentor.skillsToLearn || mentor.skillsWanted || []
      };
    });

    // Filter mentors with score > 0 and sort by score
    const rankedMentors = mentorsWithScores
      .filter(m => m.matchScore > 0)
      .sort((a, b) => {
        // Sort by score descending
        if (b.matchScore !== a.matchScore) {
          return b.matchScore - a.matchScore;
        }
        // If same score, sort by number of matched skills
        return b.matchedSkills.length - a.matchedSkills.length;
      })
      .slice(0, 20); // Top 20 matches

    console.log(`Found ${rankedMentors.length} mentor matches out of ${profiles.length} profiles`);

    return rankedMentors;

  } catch (error) {
    console.error('Error in searchMentors:', error);
    return [];
  }
}

/**
 * MENTOR REQUESTS - FIXED
 */

export async function sendMentorRequest(fromUserId, toUserId, message = '') {
  if (message) {
    const moderation = await moderateContent(message, 'message');
    if (!moderation.safe) {
      throw new Error(`Message rejected: ${moderation.reason}`);
    }
  }

  // Check if request already exists
  const existingQuery = query(
    collection(db, 'mentorRequests'),
    where('senderId', '==', fromUserId),
    where('receiverId', '==', toUserId)
  );

  const existingDocs = await getDocs(existingQuery);
  if (!existingDocs.empty) {
    const existing = existingDocs.docs[0].data();
    if (existing.status === 'pending' || existing.status === 'accepted') {
      throw new Error('You already have a pending or active request with this mentor');
    }
  }

  // Use standardized field names: senderId and receiverId
  const request = {
    senderId: fromUserId,      // Sender of the request
    receiverId: toUserId,       // Receiver of the request
    message,
    status: 'pending',
    createdAt: serverTimestamp()
  };

  console.log('Creating mentor request:', request);

  const docRef = await addDoc(collection(db, 'mentorRequests'), request);
  console.log('Mentor request created with ID:', docRef.id);

  return { id: docRef.id, ...request };
}

export async function respondToMentorRequest(requestId, accept) {
  const requestRef = doc(db, 'mentorRequests', requestId);
  const requestDoc = await getDoc(requestRef);

  if (!requestDoc.exists()) {
    throw new Error('Request not found');
  }

  await updateDoc(requestRef, {
    status: accept ? 'accepted' : 'rejected',
    respondedAt: serverTimestamp()
  });

  // If accepted, create a chat room
  if (accept) {
    const request = requestDoc.data();
    const chatRoom = {
      participants: [request.senderId, request.receiverId],
      userIds: [request.senderId, request.receiverId], // For admin metadata
      createdAt: serverTimestamp(),
      lastMessageAt: serverTimestamp()
    };

    await addDoc(collection(db, 'chatRooms'), chatRoom);
  }
}

/**
 * Get mentor requests for a user - FIXED with proper field names
 */
export async function getMentorRequests(userId, type = 'received') {
  console.log(`Getting ${type} requests for user:`, userId);

  try {
    // Use correct field names: senderId and receiverId
    const field = type === 'received' ? 'receiverId' : 'senderId';

    // Simple query without orderBy to avoid index issues
    const q = query(
      collection(db, 'mentorRequests'),
      where(field, '==', userId)
    );

    const snapshot = await getDocs(q);
    const requests = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    // Sort in memory by createdAt
    requests.sort((a, b) => {
      const aTime = a.createdAt?.toMillis?.() || 0;
      const bTime = b.createdAt?.toMillis?.() || 0;
      return bTime - aTime; // Descending
    });

    console.log(`Found ${requests.length} ${type} requests`);
    return requests;
  } catch (error) {
    console.error(`Error getting ${type} requests:`, error);
    return [];
  }
}

/**
 * Subscribe to mentor requests in real-time - NEW
 */
export function subscribeToMentorRequests(userId, type, callback) {
  const field = type === 'received' ? 'receiverId' : 'senderId';

  const q = query(
    collection(db, 'mentorRequests'),
    where(field, '==', userId)
  );

  return onSnapshot(q, (snapshot) => {
    const requests = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    // Sort by createdAt
    requests.sort((a, b) => {
      const aTime = a.createdAt?.toMillis?.() || 0;
      const bTime = b.createdAt?.toMillis?.() || 0;
      return bTime - aTime;
    });

    callback(requests);
  }, (error) => {
    console.error('Error in mentor requests subscription:', error);
    callback([]);
  });
}

/**
 * CHAT
 */

export async function getChatRooms(userId) {
  console.log(`[DB] Getting chat rooms for user: ${userId}`);

  try {
    // Simple query without orderBy to avoid index requirement
    const q = query(
      collection(db, 'chatRooms'),
      where('participants', 'array-contains', userId)
    );

    const snapshot = await getDocs(q);
    const rooms = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    // Sort in memory by lastMessageAt
    rooms.sort((a, b) => {
      const aTime = a.lastMessageAt?.toMillis?.() || 0;
      const bTime = b.lastMessageAt?.toMillis?.() || 0;
      return bTime - aTime; // Descending (newest first)
    });

    console.log(`[DB] Found ${rooms.length} chat rooms`);
    return rooms;
  } catch (error) {
    console.error('[DB] Error getting chat rooms:', error);
    return [];
  }
}

export async function sendMessage(chatRoomId, senderId, text) {
  console.log(`[DB] Sending message to chat: ${chatRoomId}`);
  console.log(`[DB] Sender: ${senderId}`);
  console.log(`[DB] Text length: ${text.length}`);

  try {
    const moderation = await moderateContent(text, 'chat');

    if (!moderation.safe) {
      console.warn('[DB] Message blocked by moderation:', moderation.reason);
      throw new Error(`Message blocked: ${moderation.reason}`);
    }
  } catch (moderationError) {
    console.warn('[DB] Moderation failed, allowing message:', moderationError.message);
    // Allow message if moderation fails (don't block on API errors)
  }

  const message = {
    chatRoomId,
    senderId,
    text,
    createdAt: serverTimestamp()
  };

  console.log('[DB] Adding message document...');
  const docRef = await addDoc(collection(db, 'messages'), message);
  console.log('[DB] ✅ Message added:', docRef.id);

  // Update chat room last message time
  console.log('[DB] Updating chat room lastMessageAt...');
  await updateDoc(doc(db, 'chatRooms', chatRoomId), {
    lastMessageAt: serverTimestamp()
  });
  console.log('[DB] ✅ Chat room updated');
}

export function subscribeToMessages(chatRoomId, callback, errorCallback) {
  console.log(`[DB] Subscribing to messages for chat: ${chatRoomId}`);

  const q = query(
    collection(db, 'messages'),
    where('chatRoomId', '==', chatRoomId),
    orderBy('createdAt', 'asc')
  );

  return onSnapshot(q,
    (snapshot) => {
      console.log(`[DB] Messages snapshot: ${snapshot.size} messages`);
      const messages = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      callback(messages);
    },
    (error) => {
      console.error('[DB] Message subscription error:', error);
      if (errorCallback) {
        errorCallback(error);
      }
    }
  );
}

export async function getMessages(chatRoomId) {
  const q = query(
    collection(db, 'messages'),
    where('chatRoomId', '==', chatRoomId),
    orderBy('createdAt', 'asc')
  );

  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

/**
 * ADMIN FUNCTIONS
 */

/**
 * Get all issues for admin dashboard
 */
export async function getAllIssuesForAdmin() {
  const q = query(
    collection(db, 'issues'),
    orderBy('createdAt', 'desc')
  );

  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

/**
 * Get issue statistics for admin
 */
export async function getIssueStats() {
  const allIssues = await getAllIssuesForAdmin();

  const stats = {
    total: allIssues.length,
    open: allIssues.filter(i => i.status === 'Open').length,
    inReview: allIssues.filter(i => i.status === 'In Review').length,
    resolved: allIssues.filter(i => i.status === 'Resolved').length,
    byCategory: {
      Safety: allIssues.filter(i => i.category === 'Safety').length,
      Hygiene: allIssues.filter(i => i.category === 'Hygiene').length,
      Infrastructure: allIssues.filter(i => i.category === 'Infrastructure').length,
      Canteen: allIssues.filter(i => i.category === 'Canteen').length
    },
    byPriority: {
      High: allIssues.filter(i => i.priority === 'High').length,
      Medium: allIssues.filter(i => i.priority === 'Medium').length,
      Low: allIssues.filter(i => i.priority === 'Low').length
    }
  };

  return stats;
}

/**
 * Subscribe to all issues (admin only)
 */
export function subscribeToAllIssues(callback) {
  const q = query(
    collection(db, 'issues'),
    orderBy('createdAt', 'desc')
  );

  return onSnapshot(q, (snapshot) => {
    const issues = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    callback(issues);
  });
}

/**
 * Get all mentor requests (admin monitoring - metadata only)
 */
export async function getAllMentorRequestsForAdmin() {
  const q = query(
    collection(db, 'mentorRequests'),
    orderBy('createdAt', 'desc')
  );

  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => {
    const data = doc.data();
    // Return only metadata, no message content
    return {
      id: doc.id,
      senderId: data.senderId,
      receiverId: data.receiverId,
      status: data.status,
      createdAt: data.createdAt,
      respondedAt: data.respondedAt
      // Explicitly exclude 'message' field
    };
  });
}

/**
 * Get mentor request statistics for admin
 */
export async function getMentorRequestStats() {
  const allRequests = await getAllMentorRequestsForAdmin();

  return {
    total: allRequests.length,
    pending: allRequests.filter(r => r.status === 'pending').length,
    accepted: allRequests.filter(r => r.status === 'accepted').length,
    rejected: allRequests.filter(r => r.status === 'rejected').length
  };
}

/**
 * Get all chat rooms (admin metadata only - NO message content)
 */
export async function getAllChatRoomsForAdmin() {
  const q = query(collection(db, 'chatRooms'));

  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => {
    const data = doc.data();
    // Return only existence metadata
    return {
      id: doc.id,
      userIds: data.userIds || data.participants || [],
      createdAt: data.createdAt,
      lastMessageAt: data.lastMessageAt,
      messageCount: 0 // Can be added later if you track this
    };
  });
}

/**
 * Get chat statistics for admin
 */
export async function getChatStats() {
  const allChats = await getAllChatRoomsForAdmin();

  return {
    totalChats: allChats.length,
    activeToday: allChats.filter(chat => {
      if (!chat.lastMessageAt) return false;
      const lastMessage = chat.lastMessageAt.toMillis?.() || 0;
      const oneDayAgo = Date.now() - (24 * 60 * 60 * 1000);
      return lastMessage > oneDayAgo;
    }).length
  };
}

