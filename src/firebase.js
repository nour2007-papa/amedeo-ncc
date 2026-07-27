import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyAFxYOBpqkCTHDfDas9yvHDDQ4NRnRFUkU",
  authDomain: "amedeo-ncc.firebaseapp.com",
  projectId: "amedeo-ncc",
  storageBucket: "amedeo-ncc.firebasestorage.app",
  messagingSenderId: "907414677653",
  appId: "1:907414677653:web:eb20e45e551a8a1127d39c",
  measurementId: "G-4QG35RF7HG"
};

// تهيئة Firebase
const app = initializeApp(firebaseConfig);

// تصدير الأدوات لاستخدامها في باقي المشروع
export const db = getFirestore(app);
export const auth = getAuth(app);