// init-firestore-config.js - Script to initialize Firestore configuration
// Run this script once to set up the configuration collection
// Usage: node scripts/init-firestore-config.js

import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, setDoc, doc } from 'firebase-admin/firestore';

// Load service account key from environment variable
const serviceAccountKey = process.env.SITE_SERVICE_ACCOUNT_KEY;
if (!serviceAccountKey) {
  console.error('❌ SITE_SERVICE_ACCOUNT_KEY environment variable is required');
  process.exit(1);
}

const serviceAccount = JSON.parse(
  Buffer.from(serviceAccountKey, 'base64').toString('utf8')
);

const app = initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore(app);

async function initializeConfig() {
  try {
    // Create configuration document
    await setDoc(doc(db, 'config', 'settings'), {
      adminEmail: process.env.ADMIN_EMAIL || 'nour2007papa@gmail.com',
      updatedAt: new Date().toISOString(),
      version: '1.0.0'
    });

    console.log('✅ Firestore configuration initialized successfully');
    console.log('📧 Admin email:', process.env.ADMIN_EMAIL || 'nour2007papa@gmail.com');
  } catch (error) {
    console.error('❌ Failed to initialize Firestore configuration:', error);
    process.exit(1);
  }
}

initializeConfig().then(() => process.exit(0));
