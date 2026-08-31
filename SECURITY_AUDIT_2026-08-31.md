# تقرير مراجعة الأمان والعلاج — Grifone NCC
## Security Audit & Remediation Report

**التاريخ:** 31 أغسطس 2026
**النطاق:** موقع الحجز العام (amedeo-ncc / vue-project-v2) — كود المصدر كامل + تاريخ git + إعدادات Vercel + Google Cloud API keys
**الحالة:** ✅ مقفول — كل بند اتصلح أو اتأكد منه

---

## 1. ملخص تنفيذي

تمت مراجعة أمنية شاملة (static code review) لمشروع Grifone NCC شملت: الكود المصدري لموقع الحجز، الـ 4 Vercel Serverless Functions، Firestore Rules، تاريخ git الكامل (131 commit)، وإعدادات Environment Variables و API Keys على Vercel و Google Cloud Console.

**التقييم العام قبل البدء:** جيد (Good) — لا توجد ثغرات حرجة، لكن فيه نقاط تحتاج علاج.
**التقييم بعد العلاج:** كل النقاط المكتشفة اتقفلت.

---

## 2. النتائج والعلاج

### 2.1 تسريب معلومات تشخيصية (Debug Info Leak) — 🟡 متوسطة
**الملف:** `src/sync-orchestrator.js`

**المشكلة:** عند فشل صلاحيات (`permission-denied`)، كان الكود بيحط `uid`/`email`/`projectId` بتاع الأدمن جوه `error.message` نفسها — ده ممكن يتسرب لأي أداة مراقبة أخطاء خارجية (Sentry وغيره) لو اتضافت مستقبلًا.

**العلاج:** فصل البيانات دي في خاصية منفصلة `error.debugInfo`، وبقت تتسجل بس في `console.error()` المحلي (لوج المتصفح بتاع الأدمن، مش أي حاجة بترسل برة).

**الحالة:** ✅ اتصلح، اتبنى، اتعمله push (commit `b005b56`)

---

### 2.2 رسائل خطأ داخلية ترجع للـ caller — 🟢 منخفضة
**الملف:** `api/sync-webhook.js`

**المشكلة:** استجابة الخطأ (`500`) كانت بترجع `error.message` الخام (تفاصيل داخلية زي أسماء حقول/بنية بيانات) للـ caller.

**العلاج:** الاستجابة بقت رسالة عامة `{error: 'sync_failed', queuedForRetry: true}` بس. التفاصيل تفضل في `console.error()` والـ Dead Letter Queue على السيرفر.

**الحالة:** ✅ اتصلح، اتبنى، اتعمله push (commit `b005b56`)

---

### 2.3 عدم اتساق CSP بين API والموقع — 🟢 منخفضة
**الملف:** `api/security-middleware.js`

**المشكلة:** الـ Content-Security-Policy بتاعة استجابات الـ API كانت فيها `'unsafe-inline'` (لـ script-src و style-src)، مش متسقة مع الـ CSP الصارمة في `vercel.json` لباقي الموقع — رغم إن استجابات الـ API JSON بس ومش بترندر HTML.

**العلاج:** الـ CSP بقت `default-src 'none'; frame-ancestors 'none';` — مناسبة لـ endpoint مبيرندرش أي محتوى في المتصفح أصلًا.

**الحالة:** ✅ اتصلح، اتبنى، اتعمله push (commit `b005b56`)

---

### 2.4 تأكيد Rate Limiting على Redis (Upstash) — تأكيد بس، مش مشكلة
**الملف:** `api/security-middleware.js`

كان فيه fallback ضعيف لـ in-memory rate limiting لو `UPSTASH_REDIS_REST_URL`/`TOKEN` مش مضبوطين (بيترجع للصفر مع كل cold start على Vercel).

**النتيجة بعد المراجعة:** المتغيرات دول مضبوطين فعليًا على **Production** في Vercel Dashboard. تم التأكد من: `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`, `SYNC_WEBHOOK_SECRET`, `SITE_SERVICE_ACCOUNT_KEY`, `FLEET_SERVICE_ACCOUNT_KEY`.

**الحالة:** ✅ متأكد منه — مفيش تعديل لازم

---

### 2.5 نظافة الرفعات المستقبلية (safe-export.sh) — تشغيلي
لوحظ إن رفعة أولى للمشروع (`amedeo-ncc-vue-git.zip`) شملت `.env`, `.env.local`, `.git` كامل — رغم وجود سكريبت `safe-export.sh` جاهز أصلًا لاستبعادهم.

**العلاج:** تم استخدام `safe-export.sh` لعمل نسخة آمنة (`vue-project-v2-safe-20260831-2210.tar.gz`) بدون `.env`/`.env.local`/`.git`/`node_modules`/`dist`.

**التوصية:** استخدام `safe-export.sh` لأي مشاركة مستقبلية للمشروع.

**الحالة:** ✅ تم

---

### 2.6 مفاتيح Firebase API غير مقيّدة بالدومين — 🟡 متوسطة
**المكان:** Google Cloud Console → APIs & Services → Credentials

**المشكلة:** المفتاح الفعلي المستخدم في الكود (`Browser key (auto created by Firebase)`) في مشروع **amedeo-ncc** كان بدون أي Application Restrictions (`None`) — يعني مقبول من أي موقع في الدنيا. Google نفسه أظهر تحذير: *"this key can currently be used with any application"*.

مشروع **amedeo-fleet** كان أفضل حالًا (Websites restriction موجود من البداية، لكن اتأكد وضبط برضه).

**ملاحظة مهمة:** مفاتيح Firebase الأمامية (`VITE_FIREBASE_API_KEY`) مش سر حقيقي من الأساس — بتظهر في bundle العميل بشكل طبيعي (Vite بيحط قيمتها الفعلية وقت الـ build). الحماية الحقيقية بتيجي من Firestore Security Rules + تقييد المفتاح بالدومين، مش من "إخفاء" المفتاح.

**العلاج:** تم تقييد المفتاحين (amedeo-ncc و amedeo-fleet) على Application restrictions → Websites، بالدومينات:
```
*.amedeo-ncc.vercel.app/*
amedeo-ncc.vercel.app/*
localhost/*
```
(ونفس الشيء لمشروع amedeo-fleet بدومين `ncc-fleet.vercel.app`)

**الحالة:** ✅ اتصلح على Google Cloud Console

---

### 2.7 مفاتيح Firebase قديمة في تاريخ git — 🟢 منخفضة (خطر نظري فقط)
**المكان:** تاريخ commits القديمة على GitHub

مفاتيح Firebase قديمة (hardcoded قبل التحويل لـ env vars) لسه ظاهرة في تاريخ الـ commits على GitHub. **مش خطر أمني حقيقي** (نفس السبب في البند 2.6 — المفاتيح دي مش أسرار من الأساس)، لكن ممكن تتنضف بـ `git filter-repo`/BFG قبل الإطلاق النهائي على الدومين العام — **عملية جذرية بتغيّر تاريخ الـ commits كله ومحتاجة force-push**، فاتفقنا نأجلها لحد ما نبقى جاهزين للنشر.

**الحالة:** ⏳ مؤجل — قرار واعي، مش منسي

---

## 3. نقاط قوة موجودة أصلًا (من غير علاج)
- `sync-webhook.js`: HMAC-SHA256 + `timingSafeEqual`، fail-closed لو الـ secret مش مضبوط
- `booking-edit.js`: مقارنة توكن بزمن ثابت، allowlist صارم للحقول، نافذة تعديل 6 ساعات
- `sync-pending.js`: الـ body مش مصدر الحقيقة، السيرفر بيقرأ من Firestore مباشرة، idempotency + anti-race transaction
- `firestore.rules`: `allow read, write: if false` افتراضي، allowlist دقيق للحقول والأطوال
- `npm audit`: صفر ثغرات في التبعيات
- `v-html` مستخدم فقط مع نصوص i18n ثابتة من الكود، مش بيانات مستخدم — مفيش XSS فعلي

---

## 4. Commits ذات الصلة
- `b005b56` — `security: fix debug info leak, generic API errors, unify CSP`

---

## 5. المتبقي / الخطوات القادمة
1. **مراجعة أمنية مماثلة لمشروع ncc-fleet** (الفرونت إند التاني) — لسه معلقة
2. **git history rewrite** لمسح المفاتيح القديمة — مؤجلة لحد ما نبقى جاهزين للنشر على الدومين العام
3. **ضبط/تحسين التزامن (sync) الخاص بالحجوزات بين amedeo-ncc و ncc-fleet** — الأولوية القادمة بعد إقفال ملف الأمان ده

---

*تم توليد هذا التقرير بالتعاون مع Claude خلال جلسة مراجعة بتاريخ 31 أغسطس 2026.*
