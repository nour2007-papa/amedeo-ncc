// performance-optimizer.js - تحسينات الأداء للمزامنة والاتصالات
// يوفر: Connection Pooling, Caching, Query Optimization

/**
 * Simple in-memory cache with TTL
 */
export class CacheManager {
  constructor(defaultTTL = 5 * 60 * 1000) { // 5 minutes default
    this.cache = new Map();
    this.defaultTTL = defaultTTL;
  }

  set(key, value, ttl = this.defaultTTL) {
    const expiresAt = Date.now() + ttl;
    this.cache.set(key, { value, expiresAt });
  }

  get(key) {
    const item = this.cache.get(key);
    if (!item) return null;

    if (Date.now() > item.expiresAt) {
      this.cache.delete(key);
      return null;
    }

    return item.value;
  }

  has(key) {
    return this.get(key) !== null;
  }

  delete(key) {
    this.cache.delete(key);
  }

  clear() {
    this.cache.clear();
  }

  // Clean expired entries
  cleanup() {
    const now = Date.now();
    for (const [key, item] of this.cache.entries()) {
      if (now > item.expiresAt) {
        this.cache.delete(key);
      }
    }
  }

  getStats() {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys())
    };
  }
}

/**
 * Query optimizer for Firestore
 */
export class QueryOptimizer {
  constructor(db) {
    this.db = db;
    this.cache = new CacheManager(10 * 60 * 1000); // 10 minutes cache
  }

  /**
   * Optimized query with caching
   */
  async query(collection, options = {}) {
    const cacheKey = this.generateCacheKey(collection, options);
    
    // Check cache first
    if (this.cache.has(cacheKey) && !options.skipCache) {
      console.log(`[QueryOptimizer] Cache hit for: ${cacheKey}`);
      return this.cache.get(cacheKey);
    }

    // Build query
    let query = this.db.collection(collection);
    
    if (options.where) {
      for (const condition of options.where) {
        query = query.where(condition.field, condition.operator, condition.value);
      }
    }
    
    if (options.orderBy) {
      query = query.orderBy(options.orderBy.field, options.orderBy.direction || 'asc');
    }
    
    if (options.limit) {
      query = query.limit(options.limit);
    }

    // Execute query
    const snapshot = await query.get();
    const results = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    // Cache results
    if (!options.skipCache) {
      this.cache.set(cacheKey, results);
    }

    return results;
  }

  /**
   * Generate cache key from query parameters
   */
  generateCacheKey(collection, options) {
    const keyParts = [collection];
    
    if (options.where) {
      keyParts.push(JSON.stringify(options.where));
    }
    
    if (options.orderBy) {
      keyParts.push(`order:${options.orderBy.field}:${options.orderBy.direction || 'asc'}`);
    }
    
    if (options.limit) {
      keyParts.push(`limit:${options.limit}`);
    }

    return keyParts.join(':');
  }

  /**
   * Invalidate cache for a collection
   */
  invalidateCollection(collection) {
    const keys = this.cache.getStats().keys.filter(key => key.startsWith(collection));
    keys.forEach(key => this.cache.delete(key));
    console.log(`[QueryOptimizer] Invalidated ${keys.length} cache entries for ${collection}`);
  }

  /**
   * Clear all cache
   */
  clearCache() {
    this.cache.clear();
  }
}

/**
 * Debounce utility for preventing rapid successive calls
 */
export function debounce(func, wait, immediate = false) {
  let timeout;
  return function executedFunction(...args) {
    const context = this;
    const later = function() {
      timeout = null;
      if (!immediate) func.apply(context, args);
    };
    const callNow = immediate && !timeout;
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
    if (callNow) func.apply(context, args);
  };
}

/**
 * Throttle utility for limiting function calls
 */
export function throttle(func, limit) {
  let inThrottle;
  return function(...args) {
    const context = this;
    if (!inThrottle) {
      func.apply(context, args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  };
}

/**
 * Batch processor for handling multiple operations efficiently
 */
export class BatchProcessor {
  constructor(db, maxBatchSize = 500) {
    this.db = db;
    this.maxBatchSize = maxBatchSize;
  }

  /**
   * Process operations in batches
   */
  async processBatch(operations) {
    const results = [];
    const batches = [];

    // Split operations into batches
    for (let i = 0; i < operations.length; i += this.maxBatchSize) {
      batches.push(operations.slice(i, i + this.maxBatchSize));
    }

    // Process each batch
    for (const batch of batches) {
      const batchResults = await this.processSingleBatch(batch);
      results.push(...batchResults);
    }

    return results;
  }

  /**
   * Process a single batch
   */
  async processSingleBatch(operations) {
    const batch = this.db.batch();
    const results = [];

    for (const operation of operations) {
      const result = this.applyOperation(batch, operation);
      results.push(result);
    }

    await batch.commit();
    return results;
  }

  /**
   * Apply operation to batch
   */
  applyOperation(batch, operation) {
    const { type, collection, docId, data } = operation;
    const ref = this.db.collection(collection).doc(docId);

    switch (type) {
      case 'set':
        batch.set(ref, data);
        break;
      case 'update':
        batch.update(ref, data);
        break;
      case 'delete':
        batch.delete(ref);
        break;
      default:
        throw new Error(`Unknown operation type: ${type}`);
    }

    return { type, collection, docId };
  }
}

/**
 * Memory leak detector
 */
export class MemoryMonitor {
  constructor() {
    this.samples = [];
    this.maxSamples = 100;
  }

  /**
   * Record memory usage
   */
  recordSample() {
    if (typeof process !== 'undefined' && process.memoryUsage) {
      const usage = process.memoryUsage();
      this.samples.push({
        timestamp: Date.now(),
        heapUsed: usage.heapUsed,
        heapTotal: usage.heapTotal,
        external: usage.external
      });

      // Keep only recent samples
      if (this.samples.length > this.maxSamples) {
        this.samples.shift();
      }
    }
  }

  /**
   * Get memory trend
   */
  getMemoryTrend() {
    if (this.samples.length < 2) return null;

    const latest = this.samples[this.samples.length - 1];
    const oldest = this.samples[0];
    const growthRate = (latest.heapUsed - oldest.heapUsed) / oldest.heapUsed;

    return {
      growthRate,
      currentHeap: latest.heapUsed,
      currentHeapTotal: latest.heapTotal,
      samples: this.samples.length
    };
  }

  /**
   * Check for memory leak
   */
  detectMemoryLeak() {
    const trend = this.getMemoryTrend();
    if (!trend) return false;

    // If memory grows more than 50% over time, potential leak
    return trend.growthRate > 0.5;
  }

  /**
   * Clear samples
   */
  clear() {
    this.samples = [];
  }
}

/**
 * Performance metrics collector
 */
export class PerformanceMetrics {
  constructor() {
    this.metrics = new Map();
  }

  /**
   * Record operation duration
   */
  recordOperation(operation, duration, success = true) {
    if (!this.metrics.has(operation)) {
      this.metrics.set(operation, {
        count: 0,
        totalDuration: 0,
        successCount: 0,
        failureCount: 0,
        minDuration: Infinity,
        maxDuration: 0
      });
    }

    const metric = this.metrics.get(operation);
    metric.count++;
    metric.totalDuration += duration;
    
    if (success) {
      metric.successCount++;
    } else {
      metric.failureCount++;
    }

    metric.minDuration = Math.min(metric.minDuration, duration);
    metric.maxDuration = Math.max(metric.maxDuration, duration);
  }

  /**
   * Get metrics for an operation
   */
  getMetrics(operation) {
    const metric = this.metrics.get(operation);
    if (!metric) return null;

    return {
      ...metric,
      averageDuration: metric.totalDuration / metric.count,
      successRate: (metric.successCount / metric.count) * 100
    };
  }

  /**
   * Get all metrics
   */
  getAllMetrics() {
    const result = {};
    for (const [operation, metric] of this.metrics.entries()) {
      result[operation] = this.getMetrics(operation);
    }
    return result;
  }

  /**
   * Clear metrics
   */
  clear() {
    this.metrics.clear();
  }
}
