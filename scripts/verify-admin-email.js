import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

initializeApp({ credential: applicationDefault() });

const auth = getAuth();
const user = await auth.getUserByEmail('nour2007papa@gmail.com');
await auth.updateUser(user.uid, { emailVerified: true });

console.log('Email verified ✅ —', user.email);