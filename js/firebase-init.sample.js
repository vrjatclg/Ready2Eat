// firebase-init.sample.js
// SETUP INSTRUCTIONS:
// 1. Copy this file to firebase-init.js 
// 2. Replace the placeholder values with your actual Firebase config
// 3. Get config from Firebase Console → Project settings → General → Your apps → Web app → Config

import { initializeApp } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js";

// TODO: Replace with your Firebase project configuration
// Get this from Firebase Console > Project settings > General > Your apps > Web app > Config
const firebaseConfig = {
  apiKey: "TODO-your-api-key",
  authDomain: "TODO-your-project.firebaseapp.com",
  projectId: "TODO-your-project-id", 
  storageBucket: "TODO-your-project.appspot.com",
  messagingSenderId: "TODO-your-sender-id",
  appId: "TODO-your-app-id"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firestore
export const db = getFirestore(app);
export { firebaseConfig };

// Example with real project ID (replace ready2eat-ef71f with your project ID):
/*
const firebaseConfig = {
  apiKey: "AIzaSyBEF...",
  authDomain: "ready2eat-ef71f.firebaseapp.com",
  projectId: "ready2eat-ef71f",
  storageBucket: "ready2eat-ef71f.appspot.com", 
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abc123def456"
};
*/