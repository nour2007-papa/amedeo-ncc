# توثيق نظام المزامنة المحسّن (Enhanced Sync System Documentation)

## 📋 نظرة عامة (Overview)

نظام المزامنة المحسّن هو حل متكامل لمزامنة بيانات الرحلات بين مشروعي amedeo-ncc و ncc-fleet مع تحسينات كبيرة في الموثوقية، الأداء، وإدارة الأخطاء.

### المكونات الرئيسية (Main Components)

1. **SyncOrchestrator** - منسق المزامنة المركزي
2. **SyncQueueManager** - إدارة قائمة انتظار المزامنة
3. **SyncMonitor** - مراقبة أداء المزامنة
4. **ConflictResolver** - حل تعارضات البيانات
5. **SyncErrorHandler** - معالجة الأخطاء المتقدمة
6. **Real-time Sync Listener** - مستمع للمزامنة الحية

## 🏗️ البنية المعمارية (Architecture)

```
┌─────────────────────────────────────────────────────────────────┐
│                   ENHANCED SYNC ARCHITECTURE                    │
└─────────────────────────────────────────────────────────────────┘

┌──────────────────┐                    ┌──────────────────┐
│   amedeo-ncc     │                    │   ncc-fleet      │
│  (Client Site)   │                    │ (Fleet Panel)    │
└────────┬─────────┘                    └────────┬─────────┘
         │                                       │
         │ 1. Booking Change                     │
         ▼                                       │
┌──────────────────┐                             │
│ SyncOrchestrator │                             │
│ - Status Mapper  │                             │
│ - Retry Logic    │                             │
│ - Conflict Res.  │                             │
└────────┬─────────┘                             │
         │ 2. Sync Operation                     │
         ├──────────────────────────────────────►│
         │                                       │
         │                                       ▼
         │                          ┌──────────────────┐
         │                          │ Fleet Mirror     │
         │                          │ - Auto Update    │
         │                          │ - Status Sync    │
         │                          └────────┬─────────┘
         │                                       │
         │ 3. Confirmation                       │
         │◄──────────────────────────────────────┤
         │                                       │
         ▼                                       │
┌──────────────────┐                             │
│ SyncQueueManager │                             │
│ - Local Queue    │                             │
│ - Auto Retry     │                             │
│ - Priority      │                             │
└────────┬─────────┘                             │
         │                                       │
         │ 4. Monitoring                         │
         ▼                                       │
┌──────────────────┐                             │
│ SyncMonitor      │                             │
│ - Metrics        │                             │
│ - Performance    │                             │
│ - Alerts         │                             │
└──────────────────┘                             │
         │                                       │
         │ 5. Error Handling                     │
         ▼                                       │
┌──────────────────┐                             │
│ SyncErrorHandler │                             │
│ - Circuit Breaker│                             │
│ - Dead Letter    │                             │
│ - Logging        │                             │
└──────────────────┘                             │
         │                                       │
         │ 6. Real-time Listener                 │
         ▼                                       │
┌──────────────────┐                             │
│ Firestore List.  │                             │
│ - Auto Detect    │                             │
│ - Debounce       │                             │
│ - Batch Process  │                             │
└──────────────────┘                             │
         │                                       │
└─────────────────────────────────────────────────────────────────┘
```

## 🔧 التثبيت والإعداد (Installation & Setup)

### 1. متطلبات البيئة (Environment Requirements)

```bash
# إضافة متغيرات البيئة في .env file
VITE_FIREBASE_API_KEY=your_firebase_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=your_messaging_sender_id
VITE_FIREBASE_APP_ID=your_app_id

VITE_FLEET_FIREBASE_API_KEY=your_fleet_firebase_api_key
VITE_FLEET_FIREBASE_AUTH_DOMAIN=your_fleet_project.firebaseapp.com
VITE_FLEET_FIREBASE_PROJECT_ID=your_fleet_project_id
VITE_FLEET_FIREBASE_STORAGE_BUCKET=your_fleet_project.firebasestorage.app
VITE_FLEET_FIREBASE_MESSAGING_SENDER_ID=your_fleet_messaging_sender_id
VITE_FLEET_FIREBASE_APP_ID=your_fleet_app_id

# Vercel Environment Variables
SITE_SERVICE_ACCOUNT_KEY=base64_encoded_service_account_key
FLEET_SERVICE_ACCOUNT_KEY=base64_encoded_fleet_service_account_key
SYNC_WEBHOOK_SECRET=your_webhook_secret
```

### 2. إعداد Service Account Keys

```bash
# تحميل Service Account Key من Firebase Console
# تحويل إلى base64
base64 -w 0 service-account-key.json > service-account-base64.txt

# إضافة إلى Vercel Environment Variables
```

### 3. نشر API Functions

```bash
# نشر على Vercel
vercel --prod

# التأكد من نشر الملفات:
# - api/sync-pending.js (موجود مسبقاً)
# - api/sync-webhook.js (جديد)
# - api/booking-edit.js (موجود مسبقاً)
```

## 📚 استخدام النظام (Usage Guide)

### الاستخدام في BookingForm.vue

```javascript
import { SyncQueueManager } from './sync-utils.js';

// إعداد Sync Queue Manager
const syncQueue = new SyncQueueManager('amedeoBookingSyncQueue');

// إضافة عملية مزامنة
syncQueue.enqueue({
  bookingId: docRef.id,
  operation: 'sync-pending',
  data: bookingData,
  options: { priority: 'high' },
});

// معالجة قائمة الانتظار
syncQueue.processQueue(orchestrator, {
  batchSize: 3,
  maxAttempts: 5,
});
```

### الاستخدام في Admin.vue

```javascript
import { setupSyncOrchestrator, SyncQueueManager, SyncMonitor, setupRealtimeSyncListener } from './sync-utils.js';

// إعداد Enhanced Sync System
const { orchestrator, config } = setupSyncOrchestrator(db, fleetDb, {
  retryConfig: {
    maxRetries: 5,
    baseDelayMs: 1000,
    maxDelayMs: 30000,
  },
  enableRealtimeSync: true,
  enableConflictResolution: true,
  logLevel: 'info',
});

// إعداد Sync Monitor
const syncMonitor = new SyncMonitor();

// إعداد Real-time Sync Listener
const unsubscribe = setupRealtimeSyncListener(db, orchestrator, {
  collectionName: 'bookings',
  debounceMs: 2000,
  onSyncStart: (bookingIds) => {
    console.log('Sync started for:', bookingIds);
  },
  onSyncComplete: (results) => {
    console.log('Sync completed:', results);
  },
  onSyncError: (error) => {
    console.error('Sync error:', error);
  },
});
```

## 🔄 حالات المزامنة (Sync States)

### حالات الرحلات (Booking Statuses)

| الحالة في amedeo-ncc | الحالة في ncc-fleet | الوصف |
|---------------------|---------------------|-------|
| `confirmed: false` | `nuovo_contatto` | رحلة غير مؤكدة (مسودة) |
| `confirmed: true` | `confermato` | رحلة مؤكدة (بدون سائق) |
| `confirmed: true` + driver | `autista_assegnato` | رحلة مؤكدة مع سائق |
| `cancelledByClient: true` | `annullato` | رحلة ملغاة |

### حالات المزامنة (Sync Statuses)

| الحالة | الوصف |
|-------|-------|
| `pending` | في انتظار المزامنة |
| `syncing` | جاري المزامنة |
| `completed` | تمت المزامنة بنجاح |
| `failed` | فشلت المزامنة |
| `conflict` | تعارض في البيانات |

## ⚡ آلية إعادة المحاولة (Retry Mechanism)

### Exponential Backoff

```javascript
// التكوين الافتراضي
{
  maxRetries: 5,           // عدد مرات إعادة المحاولة
  baseDelayMs: 1000,       // التأخير الأساسي (1 ثانية)
  maxDelayMs: 30000,       // أقصى تأخير (30 ثانية)
}

// جدول التأخير:
// المحاولة 1: 1000ms (1 ثانية)
// المحاولة 2: 2000ms (2 ثانية)
// المحاولة 3: 4000ms (4 ثانية)
// المحاولة 4: 8000ms (8 ثانية)
// المحاولة 5: 16000ms (16 ثانية)
```

### Dead Letter Queue

```javascript
// العمليات التي فشلت بعد جميع المحاولات
// تُضاف إلى Dead Letter Queue للمعالجة اليدوية

await addToDeadLetterQueue(db, operation, error);
```

## 🛡️ معالجة الأخطاء (Error Handling)

### Circuit Breaker

```javascript
// يفتح Circuit Breaker عند تكرار الأخطاء
const circuitBreaker = {
  isOpen: false,
  failureCount: 0,
  threshold: 5,              // عدد الأخطاء المسموح
  resetTimeoutMs: 60000,      // وقت إعادة التعيين (1 دقيقة)
};
```

### أنواع الأخطاء (Error Types)

| النوع | الخطورة | المعالجة |
|-------|---------|---------|
| `permission-denied` | critical | إعادة المصادقة |
| `unauthenticated` | critical | إعادة تسجيل الدخول |
| `not-found` | warning | إعادة الإنشاء |
| `unavailable` | retry | إعادة المحاولة |
| `deadline-exceeded` | retry | إعادة المحاولة |

## 📊 المراقبة والمقاييس (Monitoring & Metrics)

### مقاييس المزامنة (Sync Metrics)

```javascript
const metrics = {
  totalSyncs: 100,          // إجمالي عمليات المزامنة
  successfulSyncs: 95,      // العمليات الناجحة
  failedSyncs: 5,           // العمليات الفاشلة
  successRate: 95,          // نسبة النجاح (%)
  averageSyncTime: 1200,    // متوسط وقت المزامنة (ms)
  lastSyncTime: '2026-08-23T12:00:00Z', // آخر مزامنة
};
```

### مراقبة الأداء (Performance Monitoring)

```javascript
// تسجيل وقت المزامنة
const startTime = Date.now();
await syncOrchestrator.syncBooking(bookingId);
const duration = Date.now() - startTime;

syncMonitor.recordSync(duration, true);
```

## 🔐 الأمان (Security)

### التحقق من التوكن (Token Validation)

```javascript
// التحقق من صحة editToken
if (!b.editToken || b.editToken !== token) {
  res.status(403).json({ error: 'invalid_token' });
  return;
}
```

### نافذة التعديل (Edit Window)

```javascript
// السماح بالتعديل حتى 6 ساعات قبل الاستلام
const EDIT_WINDOW_HOURS = 6;

function withinEditWindow(b) {
  if (!b.dataOra) return true;
  const pickup = new Date(b.dataOra);
  const cutoff = new Date(pickup.getTime() - EDIT_WINDOW_HOURS * 60 * 60 * 1000);
  return new Date() < cutoff;
}
```

## 🧪 الاختبار (Testing)

### اختبار الوحدة (Unit Testing)

```javascript
// اختبار SyncOrchestrator
describe('SyncOrchestrator', () => {
  it('should sync booking successfully', async () => {
    const result = await orchestrator.syncBooking(bookingId);
    expect(result.status).toBe('completed');
  });
});
```

### اختبار التكامل (Integration Testing)

```javascript
// اختبار المزامنة الكاملة
describe('Full Sync Flow', () => {
  it('should create, confirm, and cancel booking', async () => {
    // إنشاء حجز
    // تأكيد الحجز
    // إلغاء الحجز
    // التحقق من جميع الحالات
  });
});
```

## 🚀 الأداء والتحسينات (Performance & Optimizations)

### تحسينات الأداء

1. **Debouncing**: تقليل عدد عمليات المزامنة للتغييرات المتتالية
2. **Batch Processing**: معالجة عمليات متعددة دفعة واحدة
3. **Local Caching**: تخزين البيانات محلياً لتقليل طلبات الشبكة
4. **Connection Pooling**: إعادة استخدام الاتصالات

### أفضل الممارسات (Best Practices)

1. استخدم المزامنة غير المتزامنة (async) لتجنب حظر الواجهة
2. قم بتنظيف قائمة الانتظار دورياً
3. راقب الأداء باستمرار
4. سجل جميع الأخطاء بشكل مفصل
5. اختبر النظام تحت أحمال مختلفة

## 📝 الصيانة (Maintenance)

### مهام الصيانة الدورية

- [ ] مراجعة سجلات الأخطاء أسبوعياً
- [ ] تنظيف Dead Letter Queue شهرياً
- [ ] تحديث المقاييس وتحليل الأداء
- [ ] اختبار نظام المزامنة ربع سنوياً
- [ ] تحديث التوثيق مع التغييرات

### استكشاف الأخطاء (Troubleshooting)

```javascript
// التحقق من حالة المزامنة
const syncStatus = getSyncStatus(booking);
console.log('Sync status:', syncStatus);

// التحقق من قائمة الانتظار
const queue = syncQueueManager.getQueue();
console.log('Queue status:', queue);

// التحقق من المقاييس
const metrics = syncMonitor.getMetrics();
console.log('Sync metrics:', metrics);
```

## 🔄 الترقية (Upgrading)

### من النظام القديم إلى المحسّن

1. **النسخ الاحتياطي**: احفظ نسخة من البيانات الحالية
2. **التثبيت**: أضف الملفات الجديدة
3. **الإعداد**: قم بتحديث متغيرات البيئة
4. **الاختبار**: اختبار النظام الجديد
5. **المراقبة**: راقب الأداء لعدة أيام

### التوافقية (Compatibility)

النظام المحسّن متوافق مع النظام القديم:
- يحافظ على وظائف النظام القديم
- يضيف ميزات جديدة بشكل تدريجي
- يمكن التراجع عن التغييرات إذا لزم الأمر

## 📞 الدعم (Support)

### موارد إضافية

- [Firebase Documentation](https://firebase.google.com/docs)
- [Vercel Documentation](https://vercel.com/docs)
- [Vue.js Documentation](https://vuejs.org/guide/)
- [Testing Checklist](./SYNC_TESTING_CHECKLIST.md)

### التواصل

في حالة وجود مشاكل أو استفسارات:
1. راجع التوثيق أولاً
2. تحقق من سجلات الأخطاء
3. استخدم قائمة التحقق للاختبار
4. اتصل بالدعم الفني إذا لزم الأمر

---

**ملاحظة**: هذا التوثيق يُحدث بانتظام مع تطور النظام. تأكد من مراجعة آخر الإصدارات.