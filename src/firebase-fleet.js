import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';

// Progetto Firebase separato usato da ncc-fleet (amedeo-fleet.vercel.app).
// È un progetto Firebase diverso da quello del sito (amedeo-ncc), quindi
// serve una seconda connessione — inizializzata con un nome ("fleet") per
// non entrare in conflitto con l'app Firebase principale del sito.
const fleetFirebaseConfig = {
  apiKey: 'AIzaSyCuuiR30Yg6ROvYS0kF9ZIt_twIOnZRSdw',
  authDomain: 'amedeo-fleet.firebaseapp.com',
  projectId: 'amedeo-fleet',
  storageBucket: 'amedeo-fleet.firebasestorage.app',
  messagingSenderId: '988225863401',
  appId: '1:988225863401:web:b4e98826478ca5bf1273a78',
};

let fleetDb = null;
try {
  const fleetApp = initializeApp(fleetFirebaseConfig, 'fleet');
  fleetDb = getFirestore(fleetApp);
} catch (e) {
  console.warn('Firebase (ncc-fleet) non configurato:', e);
}

export { fleetDb };
