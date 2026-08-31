// /api/sync-pending — Vercel Serverless Function (Node.js, ESM).
// Chiamata da BookingForm.vue subito dopo che un visitatore (non autenticato)
// invia una prenotazione. Usa Firebase Admin SDK per scrivere direttamente
// su amedeo-fleet (bypassa le Firestore Rules del client, che richiedono
// isAdmin() e quindi bloccherebbero un visitatore anonimo).
//
// SICUREZZA (fix): il body della richiesta NON è più fonte di verità.
// Il client manda solo bookingId; il server legge il documento reale da
// siteDb e costruisce il record fleet SOLO da quei dati verificati.
//
// Setup richiesto su Vercel (Environment Variables, Production + Preview):
//   SITE_SERVICE_ACCOUNT_KEY  = chiave service account di amedeo-ncc, in base64
//   FLEET_SERVICE_ACCOUNT_KEY = chiave service account di amedeo-fleet, in base64
//
// Per generare il base64 da un file JSON scaricato da Firebase Console:
//   (Git Bash)  base64 -w 0 nome-file.json
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
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

// ⚠️ ASSUNZIONE (da confermare): i bookingId generati da BookingForm.vue
// sono auto-id Firestore standard (20 caratteri alfanumerici). Se il progetto
// usa un altro schema di ID, questo regex va aggiornato di conseguenza.
const BOOKING_ID_RE = /^[A-Za-z0-9]{10,40}$/;

// Una prenotazione è considerata "fresca" solo se creata negli ultimi 30 minuti.
const MAX_AGE_MS = 30 * 60 * 1000;

function toMillis(value) {
  if (!value) return null;
  if (value instanceof Timestamp) return value.toMillis();
  if (typeof value?.toMillis === 'function') return value.toMillis();
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.getTime();
}

export default async function handler(req, res) {
  // تطبيق security middleware
  if (!(await applySecurityMiddleware(req, res))) {
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'method_not_allowed' });
    return;
  }

  const { bookingId } = req.body || {};

  if (!bookingId || typeof bookingId !== 'string' || !BOOKING_ID_RE.test(bookingId)) {
    res.status(400).json({ error: 'bookingId_invalid' });
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

  // --- Lettura del booking reale da siteDb (unica fonte di verità) ---
  const bookingRef = siteDb.collection('bookings').doc(bookingId);
  let bookingSnap;
  try {
    bookingSnap = await bookingRef.get();
  } catch (e) {
    console.error('[sync-pending] lettura booking fallita:', e.message);
    res.status(500).json({ error: 'booking_read_failed' });
    return;
  }

  if (!bookingSnap.exists) {
    res.status(404).json({ error: 'booking_not_found' });
    return;
  }

  const booking = bookingSnap.data() || {};

  // Idempotenza: se questo booking è già stato sincronizzato, non duplicare
  // il documento su fleetDb — rispondi con l'id già esistente.
  if (booking.fleetDocId) {
    res.status(200).json({ ok: true, fleetDocId: booking.fleetDocId, alreadySynced: true });
    return;
  }

  // Anti-abuso: rifiuta booking troppo vecchi (evita replay/riuso di bookingId).
  const createdMs = toMillis(booking.createdAt);
  if (!createdMs || Date.now() - createdMs > MAX_AGE_MS) {
    res.status(409).json({ error: 'booking_expired_or_invalid' });
    return;
  }

  // --- Costruzione dati fleet SOLO da booking (letto da siteDb) ---
  const { name, country, phone, service, serviceDate, hotel, flight, people, bags, details } = booking;

  const noteParts = [`Da sito agenzia · ${service || ''}`];
  if (flight) noteParts.push(`Volo: ${flight}`);
  if (people) noteParts.push(`Persone: ${people}`);
  if (bags) noteParts.push(`Valigie: ${bags}`);
  if (details) noteParts.push(details);

  let lastErr = null;
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt += 1) {
    try {
      // "nuovo_contatto" = bozza in ncc-fleet, nessun autista assegnato.
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

      // Doppio controllo anti-race: scrivi fleetDocId solo se ancora assente,
      // così due richieste concorrenti per lo stesso bookingId non creano
      // due documenti fleet.
      await siteDb.runTransaction(async (tx) => {
        const freshSnap = await tx.get(bookingRef);
        if (freshSnap.data()?.fleetDocId) {
          throw new Error('already_synced_race');
        }
        tx.update(bookingRef, { fleetDocId: fleetDoc.id });
      });

      res.status(200).json({ ok: true, fleetDocId: fleetDoc.id });
      return;
    } catch (e) {
      if (e.message === 'already_synced_race') {
        // Un'altra richiesta ha già sincronizzato nel frattempo: non è un errore.
        const latest = await bookingRef.get();
        res.status(200).json({ ok: true, fleetDocId: latest.data()?.fleetDocId, alreadySynced: true });
        return;
      }
      lastErr = e;
      console.warn(`[sync-pending] tentativo ${attempt}/${MAX_RETRIES} fallito:`, e.message);
      if (attempt < MAX_RETRIES) await sleep(attempt * 500);
    }
  }

  console.error('[sync-pending] tutti i tentativi falliti:', lastErr?.message);
  res.status(502).json({ error: 'sync_failed' });
}
