// Firebase Configuration
// Replace these values with your actual Firebase project credentials
// Get them from: Firebase Console > Project Settings > General > Your apps

export const firebaseConfig = {
  apiKey: "AIzaSyBfmC-a4N1CycpY4Ogu06zkaAtNmpvlwLg",
    authDomain: "pr1123.firebaseapp.com",
    projectId: "pr1123",
    storageBucket: "pr1123.firebasestorage.app",
    messagingSenderId: "1078894467182",
    appId: "1:1078894467182:web:5ae493492644c39962ae7f",
    measurementId: "G-DWQP9TJQ08"
};

// Gemini API Configuration
// Get your API key from: https://makersuite.google.com/app/apikey
export const GEMINI_API_KEY = "AIzaSyCj5BXh_0OVw0WzWSEJiN4RxuhN67vHE9k";

// Allowed college email domains
// Add your institution's email domains here
export const ALLOWED_EMAIL_DOMAINS = [
  "student.college.edu",
  "edu.college.in",
  "campuslink.com",  // For admin access
  "gmail.com",  // For testing - REMOVE IN PRODUCTION
  // Add more domains as needed
];

// Admin email addresses
// Add admin email addresses who can manage issues
export const ADMIN_EMAILS = [
  "admin@campuslink.com",  // Primary admin
  "admin@college.edu",
  // Add more admin emails
];
