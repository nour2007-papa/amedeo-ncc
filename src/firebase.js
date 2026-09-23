import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { initializeAppCheck, ReCaptchaV3Provider } from "firebase/app-check";

// Firebase configuration — read ONLY from environment variables.
// No real keys are hardcoded here; without a .env file this app
// will not connect to Firebase (see .env.example for the template).
export const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID
};

if (!firebaseConfig.apiKey) {
  console.warn('[firebase.js] VITE_FIREBASE_* env vars are missing — Firebase will not connect. Check your .env file (see .env.example).');
}

// Initialize Firebase and export services
export const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);

// FIX (S-04, 22 set 2026): App Check — impedisce a script/bot esterni al
// sito (che non passano dal browser reale con questo dominio) di scrivere
// direttamente su Firestore (es. bookings), anche senza passare dal
// form. In locale (npm run dev) serve un debug token: la prima volta che
// giri in dev, Firebase stampa in console un token generato — vai su
// Firebase Console -> App Check -> Apps -> amedeo-ncc -> Manage debug
// tokens e aggiungilo, altrimenti le scritture falliranno in locale.
if (import.meta.env.DEV) {
  // eslint-disable-next-line no-undef
  self.FIREBASE_APPCHECK_DEBUG_TOKEN = true;
}

const recaptchaSiteKey = import.meta.env.VITE_RECAPTCHA_SITE_KEY;
if (recaptchaSiteKey) {
  initializeAppCheck(app, {
    provider: new ReCaptchaV3Provider(recaptchaSiteKey),
    isTokenAutoRefreshEnabled: true,
  });
} else {
  console.warn('[firebase.js] VITE_RECAPTCHA_SITE_KEY mancante — App Check disattivato (le scritture Firestore restano protette solo dalle Security Rules).');
}
