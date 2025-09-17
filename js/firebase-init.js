// firebase-init.js - Firebase initialization (working version for testing)
// This is a working version created from the sample template

// Firebase v9 modular SDK imports
import { initializeApp } from 'https://www.gstatic.com/firebasejs/9.22.0/firebase-app.js';
import { getFirestore } from 'https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js';

// Placeholder Firebase configuration - users should replace with their actual config
const firebaseConfig = {
  apiKey: "placeholder-api-key",
  authDomain: "ready2eat-demo.firebaseapp.com",
  projectId: "ready2eat-demo",
  storageBucket: "ready2eat-demo.appspot.com",
  messagingSenderId: "123456789",
  appId: "placeholder-app-id"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firestore and export for use by storage.firestore.js
export const db = getFirestore(app);