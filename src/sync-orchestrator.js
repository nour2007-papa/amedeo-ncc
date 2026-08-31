// sync-orchestrator.js - مركزية منطق المزامنة بين amedeo-ncc و ncc-fleet
// يحتوي على:
// - Sync Orchestrator: منسق مزامنة مركزي
// - Status Mapper: معالج حالات الرحلات
// - Conflict Resolver: محلل التعارضات
// - Error Handler: معالج الأخطاء المتقدم

import { doc, getDoc, updateDoc, addDoc, collection } from 'firebase/firestore';
import { QueryOptimizer, PerformanceMetrics, debounce } from './performance-optimizer.js';
import { fleetAuth } from './firebase-fleet.js';

/**
 * Status Mapper - معالج حالات الرحلات بين النظامين
 */
export const STATUS_MAPPER = {
  // من amedeo-ncc إلى ncc-fleet
  toFleet: {
    pending: 'nuovo_contatto',
    confirmed: 'confermato',
    confirmed_with_driver: 'autista_assegnato',
    cancelled: 'annullato',
    modified: 'nuovo_contatto', // عند التعديل يعود للمراجعة
  },
  // من ncc-fleet إلى amedeo-ncc
  toSite: {
    nuovo_contatto: false,
    confermato: true,
    autista_assegnato: true,
    annullato: false,
  },
};

/**
 * Booking Sync States - حالات المزامنة
 */
export const SYNC_STATES = {
  PENDING: 'pending',
  SYNCING: 'syncing',
  COMPLETED: 'completed',
  FAILED: 'failed',
  CONFLICT: 'conflict',
};

/**
 * Sync Orchestrator - منسق مزامنة مركزي
 */
export class SyncOrchestrator {
  constructor(siteDb, fleetDb) {
    this.siteDb = siteDb;
    this.fleetDb = fleetDb;
    this.syncQueue = new Map(); // قائمة انتظار للمزامنة
    this.activeSyncs = new Set(); // عمليات المزامنة النشطة
    // BUG FIX: cooldown in-memory (NON scritto su Firestore, altrimenti
    // genererebbe a sua volta un evento 'modified' che rialimenterebbe il
    // loop). Impedisce di ritentare a raffica un bookingId appena fallito
    // — es. permission-denied — ogni volta che il realtime listener si
    // ritrigghera su un qualunque altro cambiamento della collection.
    this.lastFailedAttemptAt = new Map(); // bookingId -> timestamp ms
    this.failureCooldownMs = 60000; // non ritentare lo stesso booking fallito prima di 60s
    this.retryConfig = {
      maxRetries: 5,
      baseDelayMs: 1000,
      maxDelayMs: 30000,
    };
    
    // Performance optimization
    this.queryOptimizer = new QueryOptimizer(siteDb);
    this.fleetQueryOptimizer = new QueryOptimizer(fleetDb);
    this.metrics = new PerformanceMetrics();
  }

  /**
   * مزامنة رحلة واحدة مع آلية إعادة المحاولة
   */
  async syncBooking(bookingId, options = {}) {
    const syncId = `${bookingId}-${Date.now()}`;
    const startTime = Date.now();
    
    if (this.activeSyncs.has(bookingId)) {
      console.log(`[SyncOrchestrator] Sync already in progress for ${bookingId}`);
      return { status: SYNC_STATES.SYNCING, syncId };
    }

    const lastFailure = this.lastFailedAttemptAt.get(bookingId);
    if (lastFailure && (Date.now() - lastFailure) < this.failureCooldownMs) {
      console.log(`[SyncOrchestrator] ${bookingId} in cooldown dopo un fallimento recente, salto (retry manuale sempre disponibile).`);
      return { status: SYNC_STATES.FAILED, syncId, skipped: true, reason: 'cooldown' };
    }

    this.activeSyncs.add(bookingId);
    
    try {
      const result = await this.withExponentialBackoff(
        () => this.performSync(bookingId, options),
        this.retryConfig
      );
      
      const duration = Date.now() - startTime;
      this.metrics.recordOperation('syncBooking', duration, true);
      this.lastFailedAttemptAt.delete(bookingId);
      
      return { status: SYNC_STATES.COMPLETED, syncId, result, duration };
    } catch (error) {
      console.error(`[SyncOrchestrator] Sync failed for ${bookingId}:`, error);
      const duration = Date.now() - startTime;
      this.metrics.recordOperation('syncBooking', duration, false);
      this.lastFailedAttemptAt.set(bookingId, Date.now());

      // BUG DIAGNOSTIC: "Missing or insufficient permissions" da solo non dice
      // CON QUALE account/progetto ha provato a scrivere. Arricchiamo la
      // diagnostica con l'email/UID effettivi del fleetAuth al momento del
      // fallimento e il projectId del fleetDb.
      //
      // SICUREZZA (fix): questi dati (uid/email/projectId) NON vengono più
      // scritti dentro error.message — un error.message può finire loggato
      // da strumenti esterni (Sentry, analytics, ecc.) se in futuro vengono
      // aggiunti, e non è il posto giusto per dati che identificano un
      // account. Restano disponibili solo su error.debugInfo, letto
      // esplicitamente dal solo console.error() qui sotto (log locale del
      // browser dell'admin, mai inviato altrove).
      if (error && error.code === 'permission-denied') {
        try {
          const currentFleetUser = fleetAuth ? fleetAuth.currentUser : null;
          const projectId = this.fleetDb ? this.fleetDb.app.options.projectId : 'unknown';
          error.debugInfo = currentFleetUser
            ? `uid=${currentFleetUser.uid} email=${currentFleetUser.email} verified=${currentFleetUser.emailVerified} project=${projectId}`
            : `NESSUN utente autenticato su fleetAuth (progetto=${projectId})`;
          console.error(`[SyncOrchestrator] permission-denied — ${error.debugInfo}`);
        } catch (diagErr) {
          console.warn('[SyncOrchestrator] Diagnostica permission-denied fallita:', diagErr);
        }
      }

      return { status: SYNC_STATES.FAILED, syncId, error, duration };
    } finally {
      this.activeSyncs.delete(bookingId);
    }
  }

  /**
   * ينتظر جاهزية fleetAuth الفعلية قبل أي كتابة على fleetDb
   * (بدل ما نعتمد على currentUser مباشرة وهو لسه pending)
   */
  async waitForFleetAuth(timeoutMs = 8000) {
    if (fleetAuth.currentUser) return fleetAuth.currentUser;

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        unsubscribe();
        const err = new Error('Fleet auth non disponibile (stato: pending). Effettua il login su ncc-fleet.');
        err.code = 'unauthenticated';
        reject(err);
      }, timeoutMs);

      const unsubscribe = fleetAuth.onAuthStateChanged((user) => {
        if (user) {
          clearTimeout(timeout);
          unsubscribe();
          resolve(user);
        }
      });
    });
  }

  /**
   * تنفيذ المزامنة الفعلية
   */
  async performSync(bookingId, options) {
    // BUG FIX: كان بيكتب على fleetDb قبل ما fleetAuth يخلّص التحقق،
    // فبيرجع permission-denied ويدخل cooldown حتى لو المستخدم مسجّل دخول فعليًا.
    await this.waitForFleetAuth();

    const bookingRef = doc(this.siteDb, 'bookings', bookingId);
    const bookingSnap = await getDoc(bookingRef);
    
    if (!bookingSnap.exists()) {
      throw new Error(`Booking ${bookingId} not found`);
    }

    const booking = { id: bookingSnap.id, ...bookingSnap.data() };
    
    // تحديد حالة المزامنة المطلوبة
    const syncAction = this.determineSyncAction(booking, options);
    
    switch (syncAction.action) {
      case 'create':
        return await this.createFleetMirror(booking);
      case 'update':
        return await this.updateFleetMirror(booking, syncAction.updates);
      case 'delete':
        return await this.deleteFleetMirror(booking);
      case 'skip':
        return { skipped: true, reason: syncAction.reason };
      default:
        throw new Error(`Unknown sync action: ${syncAction.action}`);
    }
  }

  /**
   * تحديد إجراء المزامنة المطلوب
   */
  determineSyncAction(booking, options) {
    // BUG FIX: senza questo controllo, ogni sync riuscita scrive
    // bookings.syncedAt, che è essa stessa un evento 'modified' sulla
    // collection osservata dal realtime listener — ritriggerando la sync
    // all'infinito anche quando tutto funziona correttamente. Se il
    // booking è già sincronizzato più di recente dell'ultima modifica
    // reale, non c'è nulla da fare.
    if (
      !options.forceSync &&
      booking.syncedAt &&
      new Date(booking.updatedAt || booking.createdAt) <= new Date(booking.syncedAt)
    ) {
      return { action: 'skip', reason: 'Already synced, no changes since last sync' };
    }

    // إذا كان الملغى
    if (booking.cancelledByClient) {
      if (booking.fleetDocId) {
        return { action: 'update', updates: { stato: 'annullato' } };
      }
      return { action: 'skip', reason: 'Cancelled booking without fleet mirror' };
    }

    // إذا لم يكن مؤكداً (pending)
    if (!booking.confirmed) {
      if (booking.fleetDocId) {
        return { action: 'update', updates: { stato: 'nuovo_contatto' } };
      }
      return { action: 'create' };
    }

    // إذا كان مؤكداً
    if (booking.confirmed) {
      if (!booking.fleetDocId) {
        return { action: 'create' };
      }
      
      const updates = {
        stato: options.driverName ? 'autista_assegnato' : 'confermato',
      };
      
      if (options.driverName) {
        updates.autista = options.driverName;
      }
      
      return { action: 'update', updates };
    }

    return { action: 'skip', reason: 'No sync action determined' };
  }

  /**
   * إنشاء mirror في ncc-fleet
   */
  async createFleetMirror(booking) {
    const fleetData = this.buildFleetData(booking);
    const fleetDoc = await addDoc(collection(this.fleetDb, 'prenotazioni'), fleetData);
    
    // تحديث booking بـ fleetDocId
    await updateDoc(doc(this.siteDb, 'bookings', booking.id), {
      fleetDocId: fleetDoc.id,
      syncedAt: new Date().toISOString(),
    });

    // إنشاء trip إذا كان مؤكداً مع سائق
    if (booking.confirmed && fleetData.autista) {
      await this.createFleetTrip(booking, fleetDoc.id, fleetData);
    }

    return { fleetDocId: fleetDoc.id, created: true };
  }

  /**
   * تحديث mirror في ncc-fleet
   */
  async updateFleetMirror(booking, updates) {
    if (!booking.fleetDocId) {
      throw new Error('Cannot update: fleetDocId missing');
    }

    const fleetRef = doc(this.fleetDb, 'prenotazioni', booking.fleetDocId);
    
    try {
      await updateDoc(fleetRef, {
        ...updates,
        updatedAt: new Date().toISOString(),
      });
      
      // تحديث booking
      await updateDoc(doc(this.siteDb, 'bookings', booking.id), {
        syncedAt: new Date().toISOString(),
      });

      return { fleetDocId: booking.fleetDocId, updated: true };
    } catch (error) {
      if (error.code === 'not-found') {
        console.warn(`[SyncOrchestrator] Fleet doc ${booking.fleetDocId} not found, recreating`);
        return await this.createFleetMirror(booking);
      }
      throw error;
    }
  }

  /**
   * حذف/إلغاء mirror في ncc-fleet
   */
  async deleteFleetMirror(booking) {
    if (!booking.fleetDocId) {
      return { skipped: true, reason: 'No fleet mirror to delete' };
    }

    await updateDoc(doc(this.fleetDb, 'prenotazioni', booking.fleetDocId), {
      stato: 'annullato',
      updatedAt: new Date().toISOString(),
    });

    return { fleetDocId: booking.fleetDocId, deleted: true };
  }

  /**
   * إنشاء trip في ncc-fleet
   */
  async createFleetTrip(booking, fleetDocId, fleetData) {
    if (booking.fleetTripId) {
      return { skipped: true, reason: 'Trip already exists' };
    }

    const tripData = this.buildTripData(booking, fleetData);
    const tripDoc = await addDoc(collection(this.fleetDb, 'trips'), tripData);
    
    await updateDoc(doc(this.siteDb, 'bookings', booking.id), {
      fleetTripId: tripDoc.id,
    });

    return { fleetTripId: tripDoc.id, created: true };
  }

  /**
   * بناء بيانات Fleet
   */
  buildFleetData(booking) {
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
      stato: STATUS_MAPPER.toFleet.pending,
      note: noteParts.join(' | '),
      createdAt: new Date().toISOString(),
      reminderSent: false,
    };
  }

  /**
   * بناء بيانات Trip
   */
  buildTripData(booking, fleetData) {
    const pickupTime = booking.dataOra && booking.dataOra.includes('T') 
      ? booking.dataOra.split('T')[1].slice(0, 5) 
      : '';

    const tripNoteParts = [`Da sito agenzia · Autista: ${fleetData.autista}`];
    if (booking.flight) tripNoteParts.push(`Volo: ${booking.flight}`);
    if (booking.people) tripNoteParts.push(`Persone: ${booking.people}`);
    if (booking.bags) tripNoteParts.push(`Valigie: ${booking.bags}`);
    if (booking.details) tripNoteParts.push(booking.details);

    return {
      date: booking.serviceDate || new Date().toISOString().slice(0, 10),
      time: pickupTime,
      carId: '', // سيتم تحديثه عند ربط السائق
      route: `${booking.zona || 'Sito agenzia'} → ${booking.hotel || booking.service || ''}`,
      fare: 0,
      payment: '',
      notes: tripNoteParts.join(' | '),
    };
  }

  /**
   * Exponential Backoff مع retry
   */
  async withExponentialBackoff(fn, config) {
    const { maxRetries, baseDelayMs, maxDelayMs } = config;
    let lastError;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error;
        
        if (attempt === maxRetries) {
          throw error;
        }

        const delay = Math.min(
          baseDelayMs * Math.pow(2, attempt - 1),
          maxDelayMs
        );
        
        console.log(`[SyncOrchestrator] Retry ${attempt}/${maxRetries} after ${delay}ms`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    throw lastError;
  }

  /**
   * مزامنة دفعية
   */
  async syncBatch(bookingIds, options = {}) {
    const results = [];
    const batchSize = options.batchSize || 5;

    for (let i = 0; i < bookingIds.length; i += batchSize) {
      const batch = bookingIds.slice(i, i + batchSize);
      const batchResults = await Promise.allSettled(
        batch.map(id => this.syncBooking(id, options))
      );
      
      results.push(...batchResults.map((r, idx) => ({
        bookingId: batch[idx],
        status: r.status,
        value: r.status === 'fulfilled' ? r.value : r.reason,
      })));
    }

    return results;
  }

  /**
   * تنظيف الموارد
   */
  cleanup() {
    this.syncQueue.clear();
    this.activeSyncs.clear();
  }
}

/**
 * Conflict Resolver - محلل التعارضات
 */
export class ConflictResolver {
  constructor(siteDb, fleetDb) {
    this.siteDb = siteDb;
    this.fleetDb = fleetDb;
  }

  /**
   * حل تعارض في البيانات
   */
  async resolveConflict(bookingId, conflictData) {
    const bookingRef = doc(this.siteDb, 'bookings', bookingId);
    const bookingSnap = await getDoc(bookingRef);
    
    if (!bookingSnap.exists()) {
      throw new Error(`Booking ${bookingId} not found`);
    }

    const booking = { id: bookingSnap.id, ...bookingSnap.data() };
    
    // استراتيجية الحل: Last-Write-Wins مع تسجيل
    const resolution = this.applyLastWriteWins(booking, conflictData);
    
    // تطبيق الحل
    await updateDoc(bookingRef, resolution.siteUpdates);
    
    if (booking.fleetDocId && resolution.fleetUpdates) {
      await updateDoc(
        doc(this.fleetDb, 'prenotazioni', booking.fleetDocId),
        resolution.fleetUpdates
      );
    }

    return {
      resolved: true,
      strategy: 'last-write-wins',
      applied: resolution,
    };
  }

  /**
   * تطبيق استراتيجية Last-Write-Wins
   */
  applyLastWriteWins(booking, conflictData) {
    const siteUpdates = {};
    const fleetUpdates = {};

    // مقارنة الطوابع الزمنية
    const siteTimestamp = new Date(booking.updatedAt || booking.createdAt).getTime();
    const fleetTimestamp = new Date(conflictData.updatedAt || conflictData.createdAt).getTime();

    if (fleetTimestamp > siteTimestamp) {
      // Fleet data is newer
      Object.assign(siteUpdates, this.mapFleetToSite(conflictData));
      Object.assign(fleetUpdates, conflictData);
    } else {
      // Site data is newer or equal
      Object.assign(fleetUpdates, this.mapSiteToFleet(booking));
    }

    return { siteUpdates, fleetUpdates };
  }

  /**
   * تحويل بيانات Fleet إلى Site
   */
  mapFleetToSite(fleetData) {
    return {
      confirmed: STATUS_MAPPER.toSite[fleetData.stato] ?? false,
      updatedAt: new Date().toISOString(),
    };
  }

  /**
   * تحويل بيانات Site إلى Fleet
   */
  mapSiteToFleet(siteData) {
    return {
      stato: STATUS_MAPPER.toFleet[siteData.confirmed ? 'confirmed' : 'pending'],
      updatedAt: new Date().toISOString(),
    };
  }
}

/**
 * Error Handler - معالج الأخطاء المتقدم
 */
export class SyncErrorHandler {
  constructor() {
    this.errorLog = [];
    this.circuitBreaker = {
      isOpen: false,
      failureCount: 0,
      lastFailureTime: null,
      threshold: 5,
      resetTimeoutMs: 60000, // 1 minute
    };
  }

  /**
   * معالجة خطأ
   */
  handleError(error, context = {}) {
    const errorEntry = {
      timestamp: new Date().toISOString(),
      error: error.message,
      code: error.code,
      context,
      severity: this.determineSeverity(error),
    };

    this.errorLog.push(errorEntry);
    this.updateCircuitBreaker(error);

    console.error('[SyncErrorHandler]', errorEntry);

    return errorEntry;
  }

  /**
   * تحديد خطورة الخطأ
   */
  determineSeverity(error) {
    if (error.code === 'permission-denied' || error.code === 'unauthenticated') {
      return 'critical';
    }
    if (error.code === 'not-found' || error.code === 'already-exists') {
      return 'warning';
    }
    if (error.code === 'unavailable' || error.code === 'deadline-exceeded') {
      return 'retry';
    }
    return 'error';
  }

  /**
   * تحديث Circuit Breaker
   */
  updateCircuitBreaker(error) {
    if (this.shouldTripCircuitBreaker(error)) {
      this.circuitBreaker.failureCount++;
      this.circuitBreaker.lastFailureTime = Date.now();

      if (this.circuitBreaker.failureCount >= this.circuitBreaker.threshold) {
        this.circuitBreaker.isOpen = true;
        console.warn('[SyncErrorHandler] Circuit breaker opened');
      }
    }
  }

  /**
   * تحديد ما إذا كان يجب فتح Circuit Breaker
   */
  shouldTripCircuitBreaker(error) {
    const retryableErrors = ['unavailable', 'deadline-exceeded', 'resource-exhausted'];
    return retryableErrors.includes(error.code);
  }

  /**
   * التحقق من Circuit Breaker
   */
  isCircuitBreakerOpen() {
    if (!this.circuitBreaker.isOpen) {
      return false;
    }

    const timeSinceLastFailure = Date.now() - this.circuitBreaker.lastFailureTime;
    if (timeSinceLastFailure > this.circuitBreaker.resetTimeoutMs) {
      this.resetCircuitBreaker();
      return false;
    }

    return true;
  }

  /**
   * إعادة تعيين Circuit Breaker
   */
  resetCircuitBreaker() {
    this.circuitBreaker = {
      isOpen: false,
      failureCount: 0,
      lastFailureTime: null,
      threshold: this.circuitBreaker.threshold,
      resetTimeoutMs: this.circuitBreaker.resetTimeoutMs,
    };
    console.log('[SyncErrorHandler] Circuit breaker reset');
  }

  /**
   * الحصول على سجل الأخطاء
   */
  getErrorLog(filters = {}) {
    let filtered = this.errorLog;

    if (filters.severity) {
      filtered = filtered.filter(e => e.severity === filters.severity);
    }

    if (filters.since) {
      filtered = filtered.filter(e => new Date(e.timestamp) >= new Date(filters.since));
    }

    return filtered;
  }

  /**
   * مسح سجل الأخطاء
   */
  clearErrorLog() {
    this.errorLog = [];
  }
}