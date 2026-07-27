import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";

// أضفنا export قبل المتغير
export const firebaseConfig = {
  apiKey: "AIzaSyAFXYOBpqkCTHDfDas9yvHDDQ4NRnRFUkU",
  authDomain: "amedeo-ncc.firebaseapp.com",
  projectId: "amedeo-ncc",
  storageBucket: "amedeo-ncc.firebasestorage.app",
  messagingSenderId: "907414677653",
  appId: "1:907414677653:web:eb20e45e551a8a1127d39c",
  measurementId: "G-4QG35RF7HG"
};

// تهيئة Firebase وتصدير الخدمة
export const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);