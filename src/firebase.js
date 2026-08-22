import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";

// Firebase configuration using environment variables for security
export const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyAcmqPNItClwWAVaz-0-fDzVOAX1CGicz4",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "amedeo-ncc.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "amedeo-ncc",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "amedeo-ncc.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "907414677653",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:907414677653:web:eb20e45e551a8a1127d39c",
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || "G-4QG35RF7HG"
};

// Initialize Firebase and export services
export const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);