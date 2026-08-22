import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';

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
// fleetAuth: Auth SEPARATO per il progetto amedeo-fleet (diverso da quello
// del sito). SENZA questo, ogni scrittura verso fleetDb (prenotazioni, trips)
// e ogni lettura (employees) viene rifiutata dalle Firestore Rules di
// amedeo-fleet, perché quelle regole richiedono isAdmin() = signedIn() nel
// contesto del progetto fleet, non del progetto sito. Vedi login() in
// Admin.vue, dove ci si autentica su ENTRAMBI i progetti con le stesse
// credenziali admin.
let fleetAuth = null;
try {
  const fleetApp = initializeApp(fleetFirebaseConfig, 'fleet');
  fleetDb = getFirestore(fleetApp);
  fleetAuth = getAuth(fleetApp);
} catch (e) {
  console.warn('Firebase (ncc-fleet) non configurato:', e);
}

export { fleetDb, fleetAuth };
