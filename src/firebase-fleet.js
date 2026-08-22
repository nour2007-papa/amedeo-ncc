import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';

// Progetto Firebase separato usato da ncc-fleet (amedeo-fleet.vercel.app).
// È un progetto Firebase diverso da quello del sito (amedeo-ncc), quindi
// serve una seconda connessione — inizializzata con un nome ("fleet") per
// non entrare in conflitto con l'app Firebase principale del sito.
// Legge SOLO dalle variabili d'ambiente — nessuna chiave reale è
// scritta nel codice (vedi .env.example per il template).
const fleetFirebaseConfig = {
  apiKey: import.meta.env.VITE_FLEET_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FLEET_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FLEET_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FLEET_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FLEET_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FLEET_FIREBASE_APP_ID,
};

if (!fleetFirebaseConfig.apiKey) {
  console.warn('[firebase-fleet.js] VITE_FLEET_FIREBASE_* env vars are missing — fleet Firebase will not connect. Check your .env file (see .env.example).');
}

let fleetDb = null;
try {
  const fleetApp = initializeApp(fleetFirebaseConfig, 'fleet');
  fleetDb = getFirestore(fleetApp);
} catch (e) {
  console.warn('Firebase (ncc-fleet) non configurato:', e);
}

export { fleetDb };
