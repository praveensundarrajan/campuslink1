# Issue Reporting Not Working - Troubleshooting Guide

## 🐛 Problem: Issues Not Submitting to Firebase

If issues are not being saved to Firestore, follow these steps:

---

## ✅ Step 1: Check Browser Console

Open DevTools (F12) and check the Console tab when submitting an issue.

### **Good Signs (Working):**
```
[IssueReport] Submitting issue...
[IssueReport] User: abc123xyz
[IssueReport] Category: Safety
[IssueReport] Description: Broken door lock
[DB] Creating issue...
[DB] Image file: none
[DB] Moderation failed, allowing issue: ...
[DB] Categorization failed, using defaults: ...
[DB] Creating issue document in Firestore...
[DB] Issue data: {...}
[DB] ✅ Issue created successfully! ID: xyz789
[IssueReport] ✅ Issue created successfully! ID: xyz789
```

### **Bad Signs (Not Working):**
```
❌ FirebaseError: Missing or insufficient permissions
❌ FirebaseError: PERMISSION_DENIED
❌ Error: Failed to save issue
❌ Network request failed
```

---

## ✅ Step 2: Check Firebase Configuration

### **A. Check if Firebase is configured:**

Open `src/config.js` and verify:

```javascript
export const firebaseConfig = {
  apiKey: "AIzaSy...",              // ✓ Should be real API key
  authDomain: "pr1123.firebaseapp.com",  // ✓ Real project ID
  projectId: "pr1123",              // ✓ Real project ID
  storageBucket: "pr1123.appspot.com",   // ✓ Real bucket
  messagingSenderId: "...",         // ✓ Real sender ID
  appId: "..."                      // ✓ Real app ID
};
```

**If it says `"YOUR_API_KEY"` → You need to add real Firebase credentials!**

### **B. Get Firebase Config:**

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project (pr1123)
3. Click gear icon ⚙️ > Project Settings
4. Scroll to "Your apps" section
5. Click on web app (</> icon)
6. Copy the config object
7. Replace in `src/config.js`

---

## ✅ Step 3: Check Firestore Rules

### **View Current Rules:**

1. Firebase Console > Firestore Database
2. Click "Rules" tab
3. Check if rules are deployed

### **Expected Rules for Issues:**

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    function isSignedIn() {
      return request.auth != null;
    }
    
    // Issues - Anyone can create
    match /issues/{issueId} {
      allow read: if isSignedIn();
      allow create: if true;  // Allow anyone (even anonymous)
      allow update: if isSignedIn();
    }
  }
}
```

### **Deploy Rules:**

```bash
firebase deploy --only firestore:rules
```

---

## ✅ Step 4: Check User Authentication

### **Test in Console:**

Open browser console and type:

```javascript
firebase.auth().currentUser
```

**Expected Output:**
```javascript
User {
  uid: "abc123xyz",
  email: "user@college.edu",
  ...
}
```

**If `null`:**
- User is not logged in
- Sign in or use guest mode
- Check if auth is working

---

## ✅ Step 5: Manual Firestore Test

### **Test Direct Write:**

Open browser console and run:

```javascript
// Get Firestore instance
const db = firebase.firestore();

// Try to create a test issue
db.collection('issues').add({
  category: 'Infrastructure',
  description: 'Test issue from console',
  isAnonymous: false,
  status: 'Open',
  priority: 'Medium',
  tags: ['test'],
  summary: 'Test',
  createdAt: firebase.firestore.FieldValue.serverTimestamp(),
  updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
  statusHistory: [{
    status: 'Open',
    timestamp: new Date().toISOString(),
    note: 'Test'
  }]
}).then(docRef => {
  console.log('✅ Test issue created:', docRef.id);
}).catch(error => {
  console.error('❌ Error:', error);
  console.error('Error code:', error.code);
  console.error('Error message:', error.message);
});
```

**If this works:** Issue is with app code  
**If this fails:** Issue is with Firebase setup

---

## ✅ Step 6: Check Gemini API Key (Optional)

The app works WITHOUT Gemini API, but if you want AI features:

### **Get API Key:**

1. Go to [Google AI Studio](https://makersuite.google.com/app/apikey)
2. Create API key
3. Copy the key

### **Add to Config:**

In `src/config.js`:

```javascript
export const GEMINI_API_KEY = "AIzaSy...YOUR_KEY_HERE";
```

**Without API Key:**
- ✅ Issues still submit
- ✅ Uses default categorization
- ❌ No AI moderation
- ❌ No smart categorization

---

## ✅ Step 7: Common Errors & Solutions

### **Error: "Missing or insufficient permissions"**

**Cause:** Firestore rules not allowing writes

**Fix:**
```bash
firebase deploy --only firestore:rules
```

Make sure rules have:
```javascript
allow create: if true;  // For issues
```

---

### **Error: "PERMISSION_DENIED"**

**Cause:** User doesn't have write access

**Fix:**
1. Check Firestore rules
2. Verify user is authenticated
3. Ensure collection name is correct (`issues`)

---

### **Error: "Network request failed"**

**Cause:** No internet connection or Firebase down

**Fix:**
1. Check internet connection
2. Check Firebase status: https://status.firebase.google.com/
3. Try again in a few minutes

---

### **Error: "Please select a category"**

**Cause:** Category not selected in form

**Fix:**
1. Click on a category button
2. Should highlight when selected
3. Then click Submit

---

### **Error: "Failed to save issue: undefined"**

**Cause:** Firebase not initialized properly

**Fix:**
1. Check `src/config.js` has real credentials
2. Restart dev server: `npm run dev`
3. Clear browser cache and reload

---

## 🧪 Step-by-Step Test

### **1. Open Browser Console (F12)**

### **2. Fill Out Form:**
- Category: Safety
- Description: "Test broken door lock"

### **3. Click "Submit Report"**

### **4. Watch Console:**

Should see:
```
[IssueReport] Submitting issue...
[IssueReport] User: abc123
[IssueReport] Category: Safety
[IssueReport] Description: Test broken door lock
[DB] Creating issue...
[DB] Creating issue document in Firestore...
[DB] ✅ Issue created successfully! ID: xyz789
```

### **5. Verify in Firestore:**

1. Firebase Console > Firestore Database
2. Click "issues" collection
3. Should see new document with:
   - category: "Safety"
   - description: "Test broken door lock"
   - status: "Open"
   - createdAt: (timestamp)

---

## 🔧 Quick Fixes

### **Fix 1: Simplest Test (No Firebase needed)**

Check if the form works at all:

```javascript
// In IssueReport.jsx handleSubmit, add at start:
console.log('Form data:', formData);
alert('Form submitted! Check console.');
```

This tells you if the form submission itself works.

---

### **Fix 2: Skip AI Completely**

The updated code already has this! AI functions are wrapped in try-catch and use fallbacks.

If Gemini API fails:
- ✓ Issue still submits
- ✓ Uses default category from form
- ✓ Uses "Medium" priority
- ✓ Uses first 100 chars as summary

---

### **Fix 3: Temporary Open Rules**

For testing only, use these ultra-permissive rules:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if true;  // ⚠️ TESTING ONLY!
    }
  }
}
```

**Deploy:**
```bash
firebase deploy --only firestore:rules
```

**If this works:**
- Your app code is fine
- Original rules were too restrictive
- Use proper rules from Step 3

---

## ✅ Checklist

Before submitting an issue, verify:

- [ ] Firebase config has real credentials (not "YOUR_API_KEY")
- [ ] User is logged in (or using guest mode)
- [ ] Category is selected (button is highlighted)
- [ ] Description is filled (not empty)
- [ ] Browser console is open (to see errors)
- [ ] Firestore rules are deployed
- [ ] Internet connection is working
- [ ] Firebase project is active (not deleted)

---

## 📊 Success Indicators

### **✅ Issue Submitted Successfully:**

1. **UI shows:** Green checkmark + "Issue Reported" message
2. **Console shows:** `✅ Issue created successfully! ID: xyz789`
3. **Firestore shows:** New document in issues collection
4. **Redirects:** After 2 seconds to My Activity
5. **Activity shows:** Issue appears in "My Issues" tab

### **✅ Firebase Working:**

1. Can log in successfully
2. Profile loads correctly
3. Other features work (mentor search, etc.)
4. No red errors in console

---

## 🆘 Still Not Working?

### **Last Resort Debugging:**

Add this to `database.js` at the very start of `createIssue`:

```javascript
export async function createIssue(issueData, imageFile = null) {
  alert('createIssue called!');
  console.log('=== DEBUG START ===');
  console.log('issueData:', JSON.stringify(issueData, null, 2));
  console.log('Firebase initialized:', !!db);
  console.log('Collection ref:', collection(db, 'issues'));
  
  try {
    // Rest of function...
```

This will help pinpoint exactly where it's failing.

---

## 💡 Pro Tips

1. **Always check console first** - 90% of errors show there
2. **Test with simple data** - Short descriptions, no special chars
3. **Use incognito mode** - Rules out cache issues
4. **Check Firebase quotas** - Free tier has limits
5. **Try different browsers** - Rules out browser-specific bugs

---

Your issue reporting should work now! 🎉
