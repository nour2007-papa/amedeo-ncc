// /api/booking-edit — Vercel Serverless Function (Node.js, ESM).
// يخدم صفحة Modifica.vue: يتحقق من (bookingId + editToken) على السيرفر
// باستخدام Firebase Admin SDK (نفس مفاتيح sync-pending.js)، فيتخطى
// Firestore Rules تمامًا — الـ rules نفسها تفضل زي ما هي (تمنع أي قراءة/
// تعديل مباشر من المتصفح على bookings). كل التحقق من صحة التوكن ونافذة
// التعديل (6 ساعات قبل الاستلام) بيحصل هنا فقط.
//
// يستخدم نفس Environment Variables الموجودة بالفعل على Vercel:
//   SITE_SERVICE_ACCOUNT_KEY, FLEET_SERVICE_ACCOUNT_KEY
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

const EDIT_WINDOW_HOURS = 6;
const EDITABLE_FIELDS = ['dataOra', 'zona', 'destinazione', 'volo', 'passeggeri', 'bagagli', 'details'];

// Campi che il cliente può vedere (mai esporre editToken, fleetDocId, ecc.)
function publicView(b) {
  return {
    name: b.name || '',
    service: b.service || '',
    tipoServizio: b.tipoServizio || '',
    dataOra: b.dataOra || '',
    zona: b.zona || '',
    destinazione: b.destinazione || b.hotel || '',
    volo: b.volo || '',
    passeggeri: b.passeggeri || '',
    bagagli: b.bagagli || '',
    details: b.details || '',
    confirmed: !!b.confirmed,
    cancelledByClient: !!b.cancelledByClient,
  };
}

// La modifica è permessa solo fino a EDIT_WINDOW_HOURS prima del ritiro.
// Se dataOra manca o non è valida, non blocchiamo (nessun orario da rispettare).
function withinEditWindow(b) {
  if (!b.dataOra) return true;
  const pickup = new Date(b.dataOra);
  if (Number.isNaN(pickup.getTime())) return true;
  const cutoff = new Date(pickup.getTime() - EDIT_WINDOW_HOURS * 60 * 60 * 1000);
  return new Date() < cutoff;
}

function buildFleetNote(b) {
  const parts = [`Da sito agenzia · ${b.service || ''}`];
  if (b.volo) parts.push(`Volo: ${b.volo}`);
  if (b.passeggeri) parts.push(`Persone: ${b.passeggeri}`);
  if (b.bagagli) parts.push(`Valigie: ${b.bagagli}`);
  if (b.details) parts.push(b.details);
  parts.push('(modificata dal cliente — da rivedere)');
  return parts.join(' | ');
}

export default async function handler(req, res) {
  // تطبيق security middleware
  if (!applySecurityMiddleware(req, res)) {
    return;
  }

  const params = req.method === 'GET' ? req.query : (req.body || {});
  const { bookingId, token } = params;

  if (!bookingId || !token) {
    res.status(400).json({ error: 'missing_params' });
    return;
  }

  let siteDb;
  let fleetDb;
  try {
    siteDb = getFirestore(getAdminApp('site', 'SITE_SERVICE_ACCOUNT_KEY'));
    fleetDb = getFirestore(getAdminApp('fleet', 'FLEET_SERVICE_ACCOUNT_KEY'));
  } catch (e) {
    console.error('[booking-edit] init fallita:', e.message);
    res.status(500).json({ error: 'server_not_configured' });
    return;
  }

  const bookingRef = siteDb.collection('bookings').doc(bookingId);
  const snap = await bookingRef.get();
  if (!snap.exists) {
    res.status(404).json({ error: 'not_found' });
    return;
  }
  const b = snap.data();

  // Confronto costante nel tempo non necessario qui: il token è casuale a
  // 32 caratteri, non c'è un attacco di forza bruta praticabile via timing.
  if (!b.editToken || b.editToken !== token) {
    res.status(403).json({ error: 'invalid_token' });
    return;
  }

  if (req.method === 'GET') {
    res.status(200).json({
      ok: true,
      editable: !b.cancelledByClient && withinEditWindow(b),
      booking: publicView(b),
    });
    return;
  }

  if (req.method === 'POST') {
    if (b.cancelledByClient) {
      res.status(410).json({ error: 'already_cancelled' });
      return;
    }
    if (!withinEditWindow(b)) {
      res.status(403).json({ error: 'edit_window_closed' });
      return;
    }

    const { action } = params;

    if (action === 'cancel') {
      await bookingRef.update({
        confirmed: false,
        cancelledByClient: true,
        cancelledAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
      if (b.fleetDocId) {
        try {
          await fleetDb.collection('prenotazioni').doc(b.fleetDocId).update({ stato: 'annullato' });
        } catch (e) {
          console.warn('[booking-edit] mirror annullamento fallita (non bloccante):', e.message);
        }
      }
      res.status(200).json({ ok: true });
      return;
    }

    if (action === 'update') {
      const updates = params.updates || {};
      const clean = {};
      for (const field of EDITABLE_FIELDS) {
        if (field in updates) clean[field] = updates[field];
      }
      clean.confirmed = false; // il cliente ha modificato: torna "da confermare"
      clean.updatedAt = new Date().toISOString();

      try {
        await bookingRef.update(clean);
      } catch (e) {
        console.error('[booking-edit] update fallito:', e.message);
        res.status(500).json({ error: 'update_failed' });
        return;
      }

      if (b.fleetDocId) {
        const merged = { ...b, ...clean };
        try {
          await fleetDb.collection('prenotazioni').doc(b.fleetDocId).update({
            stato: 'nuovo_contatto', // torna in revisione per l'admin
            dataOra: clean.dataOra ? `${clean.dataOra}` : (b.dataOra || ''),
            destinazione: clean.destinazione || b.hotel || b.destinazione || '',
            note: buildFleetNote(merged),
          });
        } catch (e) {
          console.warn('[booking-edit] mirror aggiornamento fallita (non bloccante):', e.message);
        }
      }

      res.status(200).json({ ok: true });
      return;
    }

    res.status(400).json({ error: 'invalid_action' });
    return;
  }

  res.status(405).json({ error: 'method_not_allowed' });
}
