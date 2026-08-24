// sync-utils.js - أدوات مساعدة للمزامنة
// يمكن استيرادها في Admin.vue أو BookingForm.vue

import { SyncOrchestrator, ConflictResolver, SyncErrorHandler } from './sync-orchestrator.js';
import { MemoryMonitor, CacheManager } from './performance-optimizer.js';

/**
 * إعداد Sync Orchestrator مع إعدادات محددة
 */
export function setupSyncOrchestrator(siteDb, fleetDb, customConfig = {}) {
  const defaultConfig = {
    retryConfig: {
      maxRetries: 5,
      baseDelayMs: 1000,
      maxDelayMs: 30000,
    },
    enableRealtimeSync: true,
    enableConflictResolution: true,
    logLevel: 'info', // 'debug' | 'info' | 'warn' | 'error'
  };

  const config = { ...defaultConfig, ...customConfig };
  const orchestrator = new SyncOrchestrator(siteDb, fleetDb);
  
  // تطبيق الإعدادات المخصصة
  if (config.retryConfig) {
    orchestrator.retryConfig = { ...orchestrator.retryConfig, ...config.retryConfig };
  }

  return { orchestrator, config };
}

/**
 * Sync Queue Manager - إدارة قائمة انتظار المزامنة
 */
export class SyncQueueManager {
  constructor(storageKey = 'amedeoSyncQueue') {
    this.storageKey = storageKey;
    this.queue = this.loadQueue();
    this.processing = false;
    this.memoryMonitor = new MemoryMonitor();
    this.cache = new CacheManager(30 * 60 * 1000); // 30 minutes cache
  }

  loadQueue() {
    try {
      const raw = localStorage.getItem(this.storageKey);
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      console.warn('[SyncQueueManager] Failed to load queue:', e);
      return [];
    }
  }

  saveQueue() {
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(this.queue));
    } catch (e) {
      console.warn('[SyncQueueManager] Failed to save queue:', e);
    }
  }

  enqueue(operation) {
    const operationWithMeta = {
      ...operation,
      id: `${operation.bookingId}-${Date.now()}`,
      queuedAt: Date.now(),
      attempts: 0,
      status: 'pending',
    };

    // إزالة أي عملية قديمة لنفس الـ bookingId
    this.queue = this.queue.filter(op => op.bookingId !== operation.bookingId);
    this.queue.push(operationWithMeta);
    this.saveQueue();

    return operationWithMeta.id;
  }

  dequeue(operationId) {
    this.queue = this.queue.filter(op => op.id !== operationId);
    this.saveQueue();
  }

  getQueue() {
    return this.queue;
  }

  getPendingOperations() {
    return this.queue.filter(op => op.status === 'pending');
  }

  getFailedOperations() {
    return this.queue.filter(op => op.status === 'failed');
  }

  markAsProcessing(operationId) {
    const op = this.queue.find(o => o.id === operationId);
    if (op) {
      op.status = 'processing';
      this.saveQueue();
    }
  }

  markAsCompleted(operationId) {
    const op = this.queue.find(o => o.id === operationId);
    if (op) {
      op.status = 'completed';
      op.completedAt = Date.now();
      this.saveQueue();
    }
  }

  markAsFailed(operationId, error) {
    const op = this.queue.find(o => o.id === operationId);
    if (op) {
      op.status = 'failed';
      op.attempts = (op.attempts || 0) + 1;
      op.lastError = error.message;
      op.failedAt = Date.now();
      this.saveQueue();
    }
  }

  clearCompleted() {
    this.queue = this.queue.filter(op => op.status !== 'completed');
    this.saveQueue();
  }

  clearAll() {
    this.queue = [];
    this.saveQueue();
  }

  async processQueue(orchestrator, options = {}) {
    if (this.processing) {
      console.log('[SyncQueueManager] Queue already being processed');
      return;
    }

    this.processing = true;
    const { batchSize = 3, maxAttempts = 5 } = options;
    const pendingOps = this.getPendingOperations().slice(0, batchSize);

    // Monitor memory before processing
    this.memoryMonitor.recordSample();

    for (const op of pendingOps) {
      if (op.attempts >= maxAttempts) {
        this.markAsFailed(op.id, new Error('Max attempts exceeded'));
        continue;
      }

      this.markAsProcessing(op.id);

      try {
        const result = await orchestrator.syncBooking(op.bookingId, op.options || {});
        
        if (result.status === 'completed') {
          this.markAsCompleted(op.id);
        } else {
          this.markAsFailed(op.id, result.error);
        }
      } catch (error) {
        this.markAsFailed(op.id, error);
      }
    }

    // Monitor memory after processing
    this.memoryMonitor.recordSample();
    
    // Check for memory leaks
    if (this.memoryMonitor.detectMemoryLeak()) {
      console.warn('[SyncQueueManager] Potential memory leak detected, cleaning up');
      this.cache.cleanup();
      this.clearCompleted();
    }

    this.processing = false;
    this.clearCompleted();
  }
}

/**
 * Sync Monitor - مراقبة حالة المزامنة
 */
export class SyncMonitor {
  constructor() {
    this.metrics = {
      totalSyncs: 0,
      successfulSyncs: 0,
      failedSyncs: 0,
      averageSyncTime: 0,
      lastSyncTime: null,
      syncHistory: [],
    };
  }

  recordSync(duration, success) {
    this.metrics.totalSyncs++;
    this.metrics.lastSyncTime = Date.now();

    if (success) {
      this.metrics.successfulSyncs++;
    } else {
      this.metrics.failedSyncs++;
    }

    // تحديث المتوسط
    const totalDuration = this.metrics.syncHistory.reduce((sum, h) => sum + h.duration, 0) + duration;
    this.metrics.averageSyncTime = totalDuration / this.metrics.totalSyncs;

    // إضافة للسجل
    this.metrics.syncHistory.push({
      timestamp: Date.now(),
      duration,
      success,
    });

    // الاحتفاظ بآخر 100 عملية فقط
    if (this.metrics.syncHistory.length > 100) {
      this.metrics.syncHistory.shift();
    }
  }

  getMetrics() {
    return {
      ...this.metrics,
      successRate: this.metrics.totalSyncs > 0 
        ? (this.metrics.successfulSyncs / this.metrics.totalSyncs) * 100 
        : 0,
    };
  }

  resetMetrics() {
    this.metrics = {
      totalSyncs: 0,
      successfulSyncs: 0,
      failedSyncs: 0,
      averageSyncTime: 0,
      lastSyncTime: null,
      syncHistory: [],
    };
  }
}

/**
 * Real-time Sync Listener - مستمع للمزامنة الحية
 */
export function setupRealtimeSyncListener(db, orchestrator, options = {}) {
  const {
    collectionName = 'bookings',
    debounceMs = 1000,
    onSyncStart,
    onSyncComplete,
    onSyncError,
  } = options;

  let debounceTimer = null;
  let pendingChanges = new Set();

  const handleChange = (change) => {
    if (change.type === 'added' || change.type === 'modified') {
      pendingChanges.add(change.doc.id);
      
      // Debounce للتغييرات المتتالية
      if (debounceTimer) {
        clearTimeout(debounceTimer);
      }

      debounceTimer = setTimeout(async () => {
        const bookingIds = Array.from(pendingChanges);
        pendingChanges.clear();

        if (onSyncStart) onSyncStart(bookingIds);

        try {
          const results = await orchestrator.syncBatch(bookingIds);
          
          if (onSyncComplete) {
            onSyncComplete(results);
          }
        } catch (error) {
          if (onSyncError) {
            onSyncError(error);
          }
        }
      }, debounceMs);
    }
  };

  // إعداد listener
  const unsubscribe = db.collection(collectionName)
    .onSnapshot((snapshot) => {
      snapshot.docChanges().forEach(handleChange);
    }, (error) => {
      console.error('[RealtimeSyncListener] Error:', error);
      if (onSyncError) onSyncError(error);
    });

  return unsubscribe;
}

/**
 * Utility Functions
 */
export function generateSyncId() {
  return `sync_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

export function isSyncOperationRequired(booking) {
  // تحديد ما إذا كانت المزامنة مطلوبة
  return !booking.syncedAt || 
         new Date(booking.updatedAt || booking.createdAt) > new Date(booking.syncedAt);
}

export function getSyncStatus(booking) {
  if (!booking.syncedAt) return 'never_synced';
  if (booking.syncStatus === 'failed') return 'failed';
  if (isSyncOperationRequired(booking)) return 'pending';
  return 'synced';
}

export function formatSyncTimestamp(timestamp) {
  if (!timestamp) return 'Never';
  const date = new Date(timestamp);
  return date.toLocaleString();
}