import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import {
  getIssues,
  getMentorRequests,
  getChatRooms,
  respondToMentorRequest,
  getProfile,
  subscribeToMentorRequests  // NEW: Import real-time subscription
} from '../../services/database';
import { formatDistance } from 'date-fns';
import EmptyState from '../common/EmptyState';
import LoadingState from '../common/LoadingState';
import './ActivityScreen.css';

export default function ActivityScreen() {
  const navigate = useNavigate();
  const { user, isAnonymous } = useAuth();

  const [activeTab, setActiveTab] = useState('issues');
  const [issues, setIssues] = useState([]);
  const [requests, setRequests] = useState({ received: [], sent: [] });
  const [chats, setChats] = useState([]);
  const [loading, setLoading] = useState(true);
  const [userProfiles, setUserProfiles] = useState({}); // Cache for user profiles

  // Helper function to load user profiles
  const loadUserProfiles = async (userIds) => {
    const profiles = {};
    for (const uid of userIds) {
      if (uid !== user?.uid && !userProfiles[uid]) {
        try {
          const profile = await getProfile(uid);
          if (profile) profiles[uid] = profile;
        } catch (err) {
          console.error('Error loading profile for', uid, err);
        }
      }
    }
    setUserProfiles(prev => ({ ...prev, ...profiles }));
  };

  useEffect(() => {
    if (!user) return;

    setLoading(true);

    // For mentor requests, use real-time subscriptions
    if (activeTab === 'requests' && !isAnonymous) {
      console.log('Setting up real-time subscriptions for mentor requests');

      // Subscribe to received requests
      const unsubReceived = subscribeToMentorRequests(user.uid, 'received', (received) => {
        console.log('Received requests updated:', received);

        // Subscribe to sent requests
        const unsubSent = subscribeToMentorRequests(user.uid, 'sent', (sent) => {
          console.log('Sent requests updated:', sent);

          setRequests({ received, sent });

          // Load profiles for all users in requests
          const userIds = new Set();
          received.forEach(req => {
            if (req.senderId) userIds.add(req.senderId);
            if (req.receiverId) userIds.add(req.receiverId);
          });
          sent.forEach(req => {
            if (req.senderId) userIds.add(req.senderId);
            if (req.receiverId) userIds.add(req.receiverId);
          });

          // Load profiles
          loadUserProfiles(userIds);
          setLoading(false);
        });

        return () => unsubSent();
      });

      return () => unsubReceived();
    } else {
      loadData();
    }
  }, [activeTab, user, isAnonymous]);

  const loadData = async () => {
    if (!user) return;

    setLoading(true);
    try {
      if (activeTab === 'issues') {
        const userIssues = await getIssues({ userId: user?.uid, limit: 20 });
        setIssues(userIssues);
      } else if (activeTab === 'requests' && !isAnonymous) {
        console.log('Loading mentor requests for user:', user.uid);
        const received = await getMentorRequests(user.uid, 'received');
        const sent = await getMentorRequests(user.uid, 'sent');

        console.log('Received requests:', received);
        console.log('Sent requests:', sent);

        // Load profiles for all users in requests
        const userIds = new Set();
        received.forEach(req => {
          if (req.fromUserId) userIds.add(req.fromUserId);
          if (req.toUserId) userIds.add(req.toUserId);
        });
        sent.forEach(req => {
          if (req.fromUserId) userIds.add(req.fromUserId);
          if (req.toUserId) userIds.add(req.toUserId);
        });

        // Load profiles
        const profiles = {};
        for (const uid of userIds) {
          if (uid !== user.uid) {
            try {
              const profile = await getProfile(uid);
              if (profile) profiles[uid] = profile;
            } catch (err) {
              console.error('Error loading profile for', uid, err);
            }
          }
        }
        setUserProfiles(profiles);

        setRequests({ received, sent });
      } else if (activeTab === 'chats' && !isAnonymous) {
        console.log('Loading chat rooms for user:', user.uid);
        const rooms = await getChatRooms(user.uid);
        console.log('Chat rooms:', rooms);

        // Load profiles for chat participants
        const userIds = new Set();
        rooms.forEach(room => {
          room.participants?.forEach(p => {
            if (p !== user.uid) userIds.add(p);
          });
        });

        const profiles = {};
        for (const uid of userIds) {
          try {
            const profile = await getProfile(uid);
            if (profile) profiles[uid] = profile;
          } catch (err) {
            console.error('Error loading profile for', uid, err);
          }
        }
        setUserProfiles(profiles);

        setChats(rooms);
      }
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAcceptRequest = async (requestId, accept) => {
    try {
      await respondToMentorRequest(requestId, accept);
      loadData(); // Reload to show updated status
    } catch (error) {
      console.error('Error responding to request:', error);
      alert('Failed to respond to request: ' + error.message);
    }
  };

  const getOtherUserId = (request, isSent) => {
    // Use senderId and receiverId fields
    return isSent ? request.receiverId : request.senderId;
  };

  const getOtherUserProfile = (userId) => {
    return userProfiles[userId] || null;
  };

  const getChatPartner = (room) => {
    const partnerId = room.participants?.find(p => p !== user.uid);
    return userProfiles[partnerId] || null;
  };

  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'High': return 'var(--color-priority-high)';
      case 'Medium': return 'var(--color-priority-medium)';
      default: return 'var(--color-priority-low)';
    }
  };

  const getStatusClass = (status) => {
    switch (status) {
      case 'Open': return 'status-open';
      case 'In Review': return 'status-review';
      case 'Resolved': return 'status-resolved';
      default: return '';
    }
  };

  const formatDate = (timestamp) => {
    if (!timestamp) return '';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return formatDistance(date, new Date(), { addSuffix: true });
  };

  return (
    <div className="activity-screen">
      <div className="activity-header">
        <div className="container">
          <button
            className="btn btn-text"
            onClick={() => navigate(-1)}
          >
            ← Back
          </button>
          <h2>My Activity</h2>
        </div>
      </div>

      <div className="activity-main">
        <div className="container">
          <div className="activity-tabs">
            <button
              className={`tab-btn ${activeTab === 'issues' ? 'active' : ''}`}
              onClick={() => setActiveTab('issues')}
            >
              My Issues
            </button>
            {!isAnonymous && (
              <>
                <button
                  className={`tab-btn ${activeTab === 'requests' ? 'active' : ''}`}
                  onClick={() => setActiveTab('requests')}
                >
                  Mentor Requests
                </button>
                <button
                  className={`tab-btn ${activeTab === 'chats' ? 'active' : ''}`}
                  onClick={() => setActiveTab('chats')}
                >
                  Messages
                </button>
              </>
            )}
          </div>

          {loading ? (
            <LoadingState text="Updating your activity feed..." />
          ) : (
            <div className="activity-content">
              {/* Issues Tab */}
              {activeTab === 'issues' && (
                <div className="issues-list">
                  {issues.length === 0 ? (
                    <EmptyState
                      icon="📢"
                      title="No Issues Reported"
                      description="You haven't reported any problems yet. Help keep the campus safe and clean!"
                      action={{
                        label: "Report an Issue",
                        onClick: () => navigate('/issues/report')
                      }}
                    />
                  ) : (
                    issues.map((issue) => (
                      <div key={issue.id} className="card issue-card">
                        <div className="issue-header">
                          <div className="issue-meta">
                            <span className="tag">{issue.category}</span>
                            <span
                              className="priority-badge"
                              style={{ backgroundColor: getPriorityColor(issue.priority) }}
                            >
                              {issue.priority}
                            </span>
                          </div>
                          <span className={`status ${getStatusClass(issue.status)}`}>
                            {issue.status}
                          </span>
                        </div>
                        <p className="issue-description">{issue.description}</p>
                        {issue.imageUrl && (
                          <img src={issue.imageUrl} alt="Issue" className="issue-image" />
                        )}
                        <div className="issue-footer">
                          <span className="text-small text-muted">
                            Reported {formatDate(issue.createdAt)}
                          </span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}

              {/* Requests Tab */}
              {activeTab === 'requests' && (
                <div className="requests-section">
                  <h3>Received Requests</h3>
                  {requests.received?.length === 0 ? (
                    <EmptyState
                      icon="📥"
                      title="No Received Requests"
                      description="When students ask for your mentorship, they'll appear here."
                    />
                  ) : (
                    <div className="requests-list">
                      {requests.received?.map((req) => {
                        const otherUserId = req.senderId; // Person who sent the request
                        const otherProfile = getOtherUserProfile(otherUserId);

                        return (
                          <div key={req.id} className="card request-card">
                            <div className="request-header">
                              <div className="mentor-avatar">
                                {otherProfile?.department?.charAt(0) || 'U'}
                              </div>
                              <div className="request-info">
                                {otherProfile ? (
                                  <>
                                    <strong>{otherProfile.department || 'Unknown'}</strong>
                                    <div className="text-small text-muted">
                                      {otherProfile.year || ''} • {formatDate(req.createdAt)}
                                    </div>
                                  </>
                                ) : (
                                  <div className="text-small text-muted">
                                    {formatDate(req.createdAt)}
                                  </div>
                                )}
                              </div>
                              <span className={`tag ${req.status === 'pending' ? 'tag-warning' : 'tag-primary'}`}>
                                {req.status}
                              </span>
                            </div>
                            {req.message && (
                              <p className="request-message">"{req.message}"</p>
                            )}
                            {otherProfile?.skillsHave && otherProfile.skillsHave.length > 0 && (
                              <div className="request-skills">
                                <strong>Can teach:</strong>{' '}
                                {otherProfile.skillsHave.slice(0, 3).join(', ')}
                                {otherProfile.skillsHave.length > 3 && ` +${otherProfile.skillsHave.length - 3} more`}
                              </div>
                            )}
                            {req.status === 'pending' && (
                              <div className="request-actions">
                                <button
                                  className="btn btn-primary btn-sm"
                                  onClick={() => handleAcceptRequest(req.id, true)}
                                >
                                  Accept
                                </button>
                                <button
                                  className="btn btn-secondary btn-sm"
                                  onClick={() => handleAcceptRequest(req.id, false)}
                                >
                                  Decline
                                </button>
                              </div>
                            )}
                            {req.status !== 'pending' && (
                              <div className="request-status">
                                {req.status === 'accepted' && '✓ You accepted this request'}
                                {req.status === 'rejected' && '✗ You declined this request'}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}

                  <h3 className="mt-lg">Sent Requests</h3>
                  {requests.sent?.length === 0 ? (
                    <p className="text-muted">You haven't sent any requests yet</p>
                  ) : (
                    <div className="requests-list">
                      {requests.sent?.map((req) => {
                        const otherUserId = req.receiverId; // Person who received the request
                        const otherProfile = getOtherUserProfile(otherUserId);

                        return (
                          <div key={req.id} className="card request-card">
                            <div className="request-header">
                              <div className="mentor-avatar">
                                {otherProfile?.department?.charAt(0) || 'U'}
                              </div>
                              <div className="request-info">
                                {otherProfile ? (
                                  <>
                                    <strong>To: {otherProfile.department || 'Unknown'}</strong>
                                    <div className="text-small text-muted">
                                      {otherProfile.year || ''} • {formatDate(req.createdAt)}
                                    </div>
                                  </>
                                ) : (
                                  <div className="text-small text-muted">
                                    Sent {formatDate(req.createdAt)}
                                  </div>
                                )}
                              </div>
                              <span className={`tag ${req.status === 'pending' ? 'tag-warning' :
                                req.status === 'accepted' ? 'tag-primary' :
                                  'tag'
                                }`}>
                                {req.status}
                              </span>
                            </div>
                            {req.message && (
                              <p className="request-message">Your message: "{req.message}"</p>
                            )}
                            {req.status === 'pending' && (
                              <p className="text-small text-muted">Waiting for response...</p>
                            )}
                            {req.status === 'accepted' && (
                              <button
                                className="btn btn-primary btn-sm mt-sm"
                                onClick={() => {
                                  // Find or create chat room
                                  // For now, just navigate to activity
                                  navigate('/activity');
                                  setActiveTab('chats');
                                }}
                              >
                                View Messages
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* Chats Tab */}
              {activeTab === 'chats' && (
                <div className="chats-list">
                  {chats.length === 0 ? (
                    <EmptyState
                      icon="💬"
                      title="No Conversations"
                      description="Connect with a mentor to start chatting. Your conversations will appear here."
                    />
                  ) : (
                    chats.map((chat) => {
                      const partner = getChatPartner(chat);

                      return (
                        <div
                          key={chat.id}
                          className="card card-interactive chat-card"
                          onClick={() => navigate(`/chat/${chat.id}`)}
                        >
                          <div className="chat-header">
                            <div className="mentor-avatar">
                              {partner?.department?.charAt(0) || 'C'}
                            </div>
                            <div className="chat-info">
                              {partner ? (
                                <>
                                  <strong>{partner.department || 'Unknown User'}</strong>
                                  <span className="text-small text-muted">
                                    {partner.year || ''} • Last message {formatDate(chat.lastMessageAt)}
                                  </span>
                                </>
                              ) : (
                                <>
                                  <strong>Chat Room</strong>
                                  <span className="text-small text-muted">
                                    Last message {formatDate(chat.lastMessageAt)}
                                  </span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
