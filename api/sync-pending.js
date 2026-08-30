// /api/sync-pending — Vercel Serverless Function (Node.js, ESM).
// Chiamata da BookingForm.vue subito dopo che un visitatore (non autenticato)
// invia una prenotazione. Usa Firebase Admin SDK per scrivere direttamente
// su amedeo-fleet (bypassa le Firestore Rules del client, che richiedono
// isAdmin() e quindi bloccherebbero un visitatore anonimo).
//
// Setup richiesto su Vercel (Environment Variables, Production + Preview):
//   SITE_SERVICE_ACCOUNT_KEY  = chiave service account di amedeo-ncc, in base64
//   FLEET_SERVICE_ACCOUNT_KEY = chiave service account di amedeo-fleet, in base64
//
// Per generare il base64 da un file JSON scaricato da Firebase Console:
//   (Git Bash)  base64 -w 0 nome-file.json
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { applySecurityMiddleware } from './security-middleware.js';

function getAdminApp(name, envVar) {
  const existing = getApps().find((a) => a.name === name);
  if (existing) return existing;
  const raw = process.env[envVar];
  if (!raw) throw new Error(`Env var mancante: ${envVar}`);
  const serviceAccount = JSON.parse(Buffer.from(raw, 'base64').toString('utf8'));
  return initializeApp({ credential: cert(serviceAccount) }, name);
}

const MAX_RETRIES = 3;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export default async function handler(req, res) {
  // تطبيق security middleware
  if (!(await applySecurityMiddleware(req, res))) {
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'method_not_allowed' });
    return;
  }

  const {
    bookingId, name, country, phone, service, serviceDate,
    hotel, flight, people, bags, details,
  } = req.body || {};

  if (!bookingId) {
    res.status(400).json({ error: 'bookingId_required' });
    return;
  }

  let siteDb;
  let fleetDb;
  try {
    siteDb = getFirestore(getAdminApp('site', 'SITE_SERVICE_ACCOUNT_KEY'));
    fleetDb = getFirestore(getAdminApp('fleet', 'FLEET_SERVICE_ACCOUNT_KEY'));
  } catch (e) {
    console.error('[sync-pending] init fallita:', e.message);
    res.status(500).json({ error: 'server_not_configured' });
    return;
  }

  const noteParts = [`Da sito agenzia · ${service || ''}`];
  if (flight) noteParts.push(`Volo: ${flight}`);
  if (people) noteParts.push(`Persone: ${people}`);
  if (bags) noteParts.push(`Valigie: ${bags}`);
  if (details) noteParts.push(details);

  let lastErr = null;
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt += 1) {
    try {
      // "nuovo_contatto" = mozzetta/bozza in ncc-fleet, nessun autista assegnato.
      // Vedi bookingConstants.js (ncc-fleet) per il significato dello stato.
      const fleetDoc = await fleetDb.collection('prenotazioni').add({
        cliente: name || '',
        telefono: `${country || ''} ${phone || ''}`.trim(),
        dataOra: serviceDate ? `${serviceDate}T00:00:00` : new Date().toISOString(),
        zona: 'Sito agenzia',
        destinazione: hotel || service || '',
        veicolo: '',
        autista: '',
        stato: 'nuovo_contatto',
        note: noteParts.join(' | '),
        createdAt: new Date().toISOString(),
        reminderSent: false,
      });

      await siteDb.collection('bookings').doc(bookingId).update({
        fleetDocId: fleetDoc.id,
      });

      res.status(200).json({ ok: true, fleetDocId: fleetDoc.id });
      return;
    } catch (e) {
      lastErr = e;
      console.warn(`[sync-pending] tentativo ${attempt}/${MAX_RETRIES} fallito:`, e.message);
      if (attempt < MAX_RETRIES) await sleep(attempt * 500);
    }
  }

  console.error('[sync-pending] tutti i tentativi falliti:', lastErr?.message);
  res.status(502).json({ error: 'sync_failed' });
}
