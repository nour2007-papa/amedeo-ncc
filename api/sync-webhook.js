// /api/sync-webhook - Vercel Serverless Function لنظام المزامنة الحية
// يستقبل webhook من Firestore Cloud Functions وينفذ عمليات المزامنة
// يدعم:
// - Real-time sync triggers
// - Bidirectional sync
// - Conflict resolution
// - Dead letter queue for failed operations

import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import crypto from 'crypto';
import { applySecurityMiddleware } from './security-middleware.js';

function getAdminApp(name, envVar) {
  const existing = getApps().find((a) => a.name === name);
  if (existing) return existing;
  const raw = process.env[envVar];
  if (!raw) throw new Error(`Env var mancante: ${envVar}`);
  const serviceAccount = JSON.parse(Buffer.from(raw, 'base64').toString('utf8'));
  return initializeApp({ credential: cert(serviceAccount) }, name);
}

const WEBHOOK_SECRET = process.env.SYNC_WEBHOOK_SECRET;

/**
 * التحقق من صحة Webhook signature باستخدام HMAC-SHA256
 */
function verifyWebhookSignature(req) {
  // لو المتغير البيئي مش مضبوط على Vercel، نرفض كل الطلبات بدل ما نستخدم
  // قيمة افتراضية معروفة في الكود (كانت هنا ثغرة حرجة: fallback ثابت
  // 'default-secret-change-in-production' كان بيسمح لأي حد يعرف الكود
  // يوقّع طلبات صحيحة ويستخدم صلاحيات Admin SDK الكاملة).
  if (!WEBHOOK_SECRET) {
    console.error('[sync-webhook] SYNC_WEBHOOK_SECRET non configurato — richiesta rifiutata');
    return false;
  }

  const signature = req.headers['x-webhook-signature'];
  if (!signature) {
    console.warn('[sync-webhook] Missing webhook signature header');
    return false;
  }
  
  try {
    const payload = JSON.stringify(req.body);
    const expectedSignature = crypto
      .createHmac('sha256', WEBHOOK_SECRET)
      .update(payload)
      .digest('hex');
    
    const sigBuf = Buffer.from(signature);
    const expBuf = Buffer.from(expectedSignature);
    // timingSafeEqual يرمي خطأ لو الطولين مختلفين، فبنتحقق الأول
    const isValid = sigBuf.length === expBuf.length && crypto.timingSafeEqual(sigBuf, expBuf);
    
    if (!isValid) {
      console.warn('[sync-webhook] Invalid webhook signature');
    }
    
    return isValid;
  } catch (error) {
    console.error('[sync-webhook] Signature verification error:', error);
    return false;
  }
}

/**
 * معالج حدث إنشاء booking
 */
async function handleBookingCreated(event, siteDb, fleetDb) {
  const booking = event.data;
  console.log(`[sync-webhook] Booking created: ${booking.id}`);
  
  // إنشاء mirror في ncc-fleet
  const fleetData = buildFleetData(booking);
  const fleetDoc = await fleetDb.collection('prenotazioni').add(fleetData);
  
  // تحديث booking بـ fleetDocId
  await siteDb.collection('bookings').doc(booking.id).update({
    fleetDocId: fleetDoc.id,
    syncedAt: new Date().toISOString(),
    syncStatus: 'completed',
  });
  
  return { fleetDocId: fleetDoc.id, status: 'created' };
}

/**
 * معالج حدث تحديث booking
 */
async function handleBookingUpdated(event, siteDb, fleetDb) {
  const booking = event.data;
  console.log(`[sync-webhook] Booking updated: ${booking.id}`);
  
  if (!booking.fleetDocId) {
    // إذا لم يكن هناك mirror، قم بإنشائه
    return await handleBookingCreated(event, siteDb, fleetDb);
  }
  
  // تحديد التحديثات المطلوبة
  const updates = determineFleetUpdates(booking);
  
  try {
    await fleetDb.collection('prenotazioni').doc(booking.fleetDocId).update({
      ...updates,
      updatedAt: new Date().toISOString(),
    });
    
    await siteDb.collection('bookings').doc(booking.id).update({
      syncedAt: new Date().toISOString(),
      syncStatus: 'completed',
    });
    
    return { fleetDocId: booking.fleetDocId, status: 'updated' };
  } catch (error) {
    if (error.code === 'not-found') {
      console.warn(`[sync-webhook] Fleet doc ${booking.fleetDocId} not found, recreating`);
      return await handleBookingCreated(event, siteDb, fleetDb);
    }
    throw error;
  }
}

/**
 * معالج حدث حذف booking
 */
async function handleBookingDeleted(event, siteDb, fleetDb) {
  const booking = event.data;
  console.log(`[sync-webhook] Booking deleted: ${booking.id}`);
  
  if (booking.fleetDocId) {
    await fleetDb.collection('prenotazioni').doc(booking.fleetDocId).update({
      stato: 'annullato',
      updatedAt: new Date().toISOString(),
      deletedAt: new Date().toISOString(),
    });
  }
  
  return { fleetDocId: booking.fleetDocId, status: 'deleted' };
}

/**
 * معالج حدث من ncc-fleet (للمزامنة ثنائية الاتجاه)
 */
async function handleFleetEvent(event, siteDb, fleetDb) {
  const fleetDoc = event.data;
  console.log(`[sync-webhook] Fleet event: ${fleetDoc.id}`);
  
  // البحث عن booking المرتبط
  const bookingsQuery = await siteDb.collection('bookings')
    .where('fleetDocId', '==', fleetDoc.id)
    .limit(1)
    .get();
  
  if (bookingsQuery.empty) {
    console.log(`[sync-webhook] No booking found for fleetDocId: ${fleetDoc.id}`);
    return { status: 'skipped', reason: 'no_matching_booking' };
  }
  
  const bookingDoc = bookingsQuery.docs[0];
  const booking = bookingDoc.data();
  
  // تحديث booking بناءً على حالة fleet
  const siteUpdates = mapFleetStatusToSite(fleetDoc);
  
  await siteDb.collection('bookings').doc(bookingDoc.id).update({
    ...siteUpdates,
    syncedAt: new Date().toISOString(),
    syncStatus: 'completed',
  });
  
  return { bookingId: bookingDoc.id, status: 'synced_from_fleet' };
}

/**
 * بناء بيانات Fleet
 */
function buildFleetData(booking) {
  const noteParts = [`Da sito agenzia · ${booking.service || ''}`];
  if (booking.flight) noteParts.push(`Volo: ${booking.flight}`);
  if (booking.people) noteParts.push(`Persone: ${booking.people}`);
  if (booking.bags) noteParts.push(`Valigie: ${booking.bags}`);
  if (booking.details) noteParts.push(booking.details);

  return {
    cliente: booking.name || '',
    telefono: `${booking.country || ''} ${booking.phone || ''}`.trim(),
    dataOra: booking.serviceDate ? `${booking.serviceDate}T00:00:00` : new Date().toISOString(),
    zona: booking.zona || 'Sito agenzia',
    destinazione: booking.hotel || booking.service || '',
    veicolo: '',
    autista: '',
    stato: booking.confirmed ? 'confermato' : 'nuovo_contatto',
    note: noteParts.join(' | '),
    createdAt: new Date().toISOString(),
    reminderSent: false,
  };
}

/**
 * تحديد التحديثات المطلوبة في Fleet
 */
function determineFleetUpdates(booking) {
  const updates = {};
  
  if (booking.cancelledByClient) {
    updates.stato = 'annullato';
  } else if (booking.confirmed) {
    updates.stato = 'confermato';
  } else {
    updates.stato = 'nuovo_contatto';
  }
  
  // تحديث الحقول الأخرى
  if (booking.dataOra) updates.dataOra = booking.dataOra;
  if (booking.destinazione) updates.destinazione = booking.destinazione;
  if (booking.volo && typeof booking.volo === 'string') {
    // تحديث note لإضافة معلومات الرحلة
    const existingNote = booking.note || '';
    updates.note = existingNote.includes(`Volo: ${booking.volo}`) 
      ? existingNote 
      : `${existingNote} | Volo: ${booking.volo}`;
  }
  
  return updates;
}

/**
 * تحويل حالة Fleet إلى Site
 */
function mapFleetStatusToSite(fleetDoc) {
  const statusMap = {
    'nuovo_contatto': { confirmed: false },
    'confermato': { confirmed: true },
    'autista_assegnato': { confirmed: true },
    'annullato': { confirmed: false, cancelledByClient: true },
  };
  
  return statusMap[fleetDoc.stato] || { confirmed: false };
}

/**
 * إضافة إلى Dead Letter Queue
 */
async function addToDeadLetterQueue(db, operation, error) {
  await db.collection('sync_dead_letter_queue').add({
    operation,
    error: {
      message: error.message,
      code: error.code,
      stack: error.stack,
    },
    queuedAt: new Date().toISOString(),
    retryCount: 0,
    status: 'pending',
  });
}

/**
 * Main handler
 */
export default async function handler(req, res) {
  // تطبيق security middleware
  if (!(await applySecurityMiddleware(req, res))) {
    return;
  }

  // التحقق من الأسلوب
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'method_not_allowed' });
    return;
  }

  // التحقق من Webhook signature (إلزامي في الإنتاج)
  if (!verifyWebhookSignature(req)) {
    res.status(401).json({ error: 'invalid_signature' });
    return;
  }

  const { eventType, source, data } = req.body || {};

  if (!eventType || !source || !data) {
    res.status(400).json({ error: 'missing_required_fields' });
    return;
  }

  let siteDb;
  let fleetDb;
  try {
    siteDb = getFirestore(getAdminApp('site', 'SITE_SERVICE_ACCOUNT_KEY'));
    fleetDb = getFirestore(getAdminApp('fleet', 'FLEET_SERVICE_ACCOUNT_KEY'));
  } catch (e) {
    console.error('[sync-webhook] init fallita:', e.message);
    res.status(500).json({ error: 'server_not_configured' });
    return;
  }

  try {
    let result;
    
    switch (source) {
      case 'amedeo-ncc':
        switch (eventType) {
          case 'booking.created':
            result = await handleBookingCreated({ data }, siteDb, fleetDb);
            break;
          case 'booking.updated':
            result = await handleBookingUpdated({ data }, siteDb, fleetDb);
            break;
          case 'booking.deleted':
            result = await handleBookingDeleted({ data }, siteDb, fleetDb);
            break;
          default:
            res.status(400).json({ error: 'unknown_event_type' });
            return;
        }
        break;
        
      case 'ncc-fleet':
        result = await handleFleetEvent({ data }, siteDb, fleetDb);
        break;
        
      default:
        res.status(400).json({ error: 'unknown_source' });
        return;
    }

    res.status(200).json({ ok: true, result });
  } catch (error) {
    console.error('[sync-webhook] Error:', error);
    
    // إضافة إلى Dead Letter Queue
    try {
      await addToDeadLetterQueue(siteDb, { eventType, source, data }, error);
    } catch (dlqError) {
      console.error('[sync-webhook] Failed to add to DLQ:', dlqError);
    }
    
    // SICUREZZA (fix): non rimandiamo più error.message al chiamante — può
    // contenere dettagli interni (nomi di campi, struttura dati, path di
    // Firestore). Il dettaglio resta in console.error() sopra e nella DLQ;
    // il chiamante riceve solo un errore generico.
    res.status(500).json({ 
      error: 'sync_failed', 
      queuedForRetry: true 
    });
  }
}