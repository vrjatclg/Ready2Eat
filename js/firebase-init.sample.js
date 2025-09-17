// firebase-init.sample.js - Firebase initialization template
// Copy this file to js/firebase-init.js and paste your Firebase config

// Firebase v9 modular SDK imports
import { initializeApp } from 'https://www.gstatic.com/firebasejs/9.22.0/firebase-app.js';
import { getFirestore } from 'https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js';

// TODO: Replace with your actual Firebase Web App configuration
// Get this from Firebase Console > Project Settings > Web Apps
const firebaseConfig = {
  apiKey: "your-api-key-here",
  authDomain: "your-project.firebaseapp.com",
  projectId: "your-project-id",
  storageBucket: "your-project.appspot.com",
  messagingSenderId: "123456789",
  appId: "your-app-id"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firestore and export for use by storage.firestore.js
export const db = getFirestore(app);