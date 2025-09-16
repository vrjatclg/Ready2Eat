// firebase-init.sample.js
// Copy this file to firebase-init.js and replace the placeholder values with your actual Firebase config

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