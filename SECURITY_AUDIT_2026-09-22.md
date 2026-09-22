# تقرير المراجعة الأمنية والتقنية — Grifone / Amedeo NCC (موقع الحجز)

| | |
|---|---|
| **التاريخ** | 22 سبتمبر 2026 |
| **النطاق** | `vue-project-v2-safe-20260921-2141.zip` (82 ملفًا: Vue 3 + Vite 8 + Firebase + Vercel Functions) |
| **النسخة المرجعية السابقة** | `SECURITY_AUDIT_2026-08-31.md` (البنود المُغلقة هناك لم تُكرَّر هنا إلا عند وجود أثر متبقٍّ) |
| **تحديث** | تمت مراجعة تقرير خارجي (Devin AI) بتاريخ 22 سبتمبر — بند واحد فعلي جديد أُضيف (S-11)؛ بقية بنوده (Rate Limiting، HMAC، Request Size، Sanitization) مغطاة بالفعل في §2/§4 أدناه |
| **مقياس الخطورة** | CVSS v3.1 — الدرجات المسبوقة بـ `~` تقديرية لأنها إعدادات/امتثال لا ثغرات قابلة للحساب الدقيق |

---

## 1) الملخص التنفيذي

**الحكم العام: أمان «متوسط»، وجاهزية تشغيلية «مقبولة بشروط».**
الكود نفسه (ما يخص XSS والحقن وأسرار المستودع والتبعيات) في حالة جيدة بعد جولات التدقيق السابقة. المخاطر المتبقية **ليست في الكود الظاهر بل في الحدود بين الأنظمة**: قواعد Firestore المفتوحة للإنشاء بلا تحقق كافٍ، لوحة إدارة بعامل واحد للمصادقة، مشروع `amedeo-fleet` الذي لا نراه في هذا الأرشيف، ومنظومة مزامنة تعتمد على متصفح الأدمن المفتوح.

| المجال | التقييم | ملاحظة مختصرة |
|---|---|---|
| الهوية والصلاحيات (IAM) | ضعيف–متوسط | لا MFA، بريد الأدمن ظاهر في الحزمة العامة، نفس كلمة السر على مشروعين |
| أمان البيانات والتشفير | متوسط | TLS/HSTS سليم؛ التشفير at-rest تتولاه Google؛ بيانات شخصية تُترك في localStorage الزوّار |
| ثغرات OWASP Top 10 | جيد | لا XSS/SQLi قابل للاستغلال؛ الثغرة الرئيسية A01 (Access Control) في حدود Firebase |
| أمان الـ API | متوسط–جيد | HMAC وRate Limit وإعادة قراءة السجل من السيرفر؛ نقاط ضعف في الـ replay والتحقق من الأنواع |
| البنية التحتية/السحابة | غير مكتمل المراجعة | Vercel/GCP Console وقواعد `amedeo-fleet` خارج الأرشيف (انظر §3) |
| جودة الكود | متوسط | مكوّنات ضخمة، تكرار، لا اختبارات ولا CI ولا Lint |
| الأداء | جيد | تحميل كسول لـ Firebase؛ نقاط تحسين محددة |
| الاعتمادية والتعافي (DR) | ضعيف | لا نسخ احتياطي موثّق، حذف نهائي من الواجهة، لا مراقبة، DLQ بلا مستهلك |

**ما يجب إغلاقه قبل أي إطلاق على دومين خاص أو حملة تسويقية (P0):**
1. التحقق من قواعد/تسجيل `amedeo-fleet` (S-01) — قد يكون أخطر بند إن تأكد.
2. إغلاق الإنشاء المفتوح على `bookings` (App Check + قواعد صارمة) (S-02).
3. MFA + إزالة بريد الأدمن من الحزمة (S-03).
4. ~~إزالة مسار تعديل/إلغاء الحجز المُعطَّل فعليًا (S-04).~~ ✅ مغلق 22 سبتمبر.
5. إصلاح تكرار وثائق الأسطول في `sync-pending` (T-01).

**ما هو سليم فعلًا (لا يحتاج عملًا):** لا أسرار أو مفاتيح خاصة في الأرشيف (فحص regex شامل)، `npm audit` = **0 ثغرات**، لا source maps في البناء، كل `v-html` مصدره نصوص i18n ثابتة، استخدام `crypto.getRandomValues` و`timingSafeEqual`، `sync-pending` لا يثق بجسم الطلب ويعيد قراءة السجل من Firestore، الويبهوك يفشل مغلقًا بلا سر، رؤوس HSTS/XFO/nosniff/CSP مع `frame-ancestors 'none'` وTrusted Types، `rel="noopener"` على الروابط الخارجية.

---

## 2) مصفوفة المخاطر

| المعرّف | الموضوع | الخطورة | CVSS | الأثر على العمليات | الجهد | الأولوية |
|---|---|---|---|---|---|---|
| S-01 | قواعد/تسجيل `amedeo-fleet` (`isAdmin() = signedIn()` بحسب تعليق في الكود) | **حرج — مشروط بالتحقق** | 9.1 | قراءة/تعديل حجوزات وسائقين ومواقع حيّة لأي مسجَّل | منخفض | P0 |
| S-03 | لوحة الإدارة: عامل واحد + بريد الأدمن ومسار اللوحة مكشوفان | **مرتفع** | 7.4 | استيلاء على لوحة فيها هواتف كل العملاء | متوسط | P0 |
| S-02 | إنشاء `bookings` مفتوح بلا App Check وبتحقق ناقص للحقول | **متوسط** | 6.5 | سبام حجوزات، حقن قيم غير صالحة إلى لوحة الأسطول، تكلفة | متوسط | P0 |
| S-05 | `sync-webhook`: replay، توقيع على JSON معاد تسلسله، لا مستدعي في المستودع | **متوسط** | 5.9 | إنشاء وثائق أسطول مكررة/معدّلة إن تسرّب السر | منخفض | P1 |
| S-06 | مفاتيح Service Account طويلة الأمد وصلاحياتها الافتراضية | **متوسط** | ~5.0 | اتساع الضرر عند أي تسريب | متوسط | P1 |
| S-04 | `/api/booking-edit` حيّ رغم إيقاف الميزة | ~~متوسط~~ **✅ مغلق (22 سبت)** | 4.8 | إلغاء/تعديل بتوكن قديم + استثناءات غير معالجة | منخفض | — |
| S-07 | بيانات شخصية دائمة في localStorage للزوّار + طلبات لأطراف ثالثة مقابل نص خصوصية | **متوسط (امتثال)** | ~4.0 | مخالفة GDPR محتملة | منخفض | P1 |
| S-08 | تشديد CSP والرؤوس | منخفض | ~3.1 | تخفيف أثر أي XSS مستقبلي | منخفض | P2 |
| S-09 | تصميم Rate Limit واستثناءات غير معالجة | منخفض | ~3.1 | تعطّل جزئي/تجاوز حدود | منخفض | P2 |
| S-10 | سلسلة التوريد ونظافة المستودع | منخفض | ~2.5 | تسريب عرضي/بناء غير قابل للتكرار | منخفض | P2 |
| S-11 | لا IP Whitelisting على مسارات حساسة (`sync-webhook`, `booking-edit`, أي API إدارية) | منخفض | ~3.5 | يقلّل سطح الهجوم على endpoints لا تحتاج وصولًا عامًا واسعًا | منخفض | P2 |
| T-01 | المزامنة تعتمد على تبويب الأدمن + سباق ينتج وثائق مكررة | **مرتفع** | — | حجوزات مكررة/مفقودة في لوحة السائقين | متوسط | P0 |
| T-02 | لا نسخ احتياطي/مراقبة، حذف نهائي، DLQ بلا مستهلك | **متوسط** (مرتفع إن لم يوجد PITR) | — | فقدان بيانات بلا رجعة | منخفض | P1 |
| T-03 | عيوب وظيفية في التحقق (رقم الرحلة، `sanitizeInput`) | ~~متوسط~~ **✅ مغلق (22 سبت)** | — | رفض حجوزات مشروعة (easyJet/Wizz)، تشويه نصوص | منخفض | — |
| T-04 | SEO: نطاق `www.amedeo-ncc.vercel.app` في canonical/sitemap، robots غير صالح | **متوسط** | — | احتمال تجاهل الفهرسة | منخفض | P1 |
| T-05 | الأداء (حزمة Auth في مسار الزائر، polling، region) | منخفض | — | زمن تحميل/استجابة | منخفض | P2 |
| T-06 | جودة الكود/التوثيق/الأدوات | منخفض | — | كلفة صيانة، أخطاء تتكرر | متوسط | P2 |

---

## 3) المنهجية وحدودها (بصراحة)

**ما نُفِّذ فعلًا:** مراجعة يدوية سطرًا بسطر لـ `api/*`، `firestore.rules`، `vercel.json`، `main.js`، `firebase*.js`، `BookingForm.vue`، `Admin.vue` (المصادقة والمزامنة والحذف)، `Modifica.vue`، `sync-utils.js`، `sync-orchestrator.js` (فحص أنماط)، ملفات `public/`، `scripts/`؛ فحص أسرار بـ regex؛ `npm ci` + `npm audit` (صفر ثغرات)؛ **بناء فعلي** (`vite build`) للتحقق مما يصل إلى الحزمة العامة؛ **اختبارات صغيرة محلية** (سلوك `Firestore.doc()` مع معرّفات خبيثة، ومحقّق رقم الرحلة، و`sanitizeInput`).

**ما لم يُنفَّذ ولا أدّعيه:**
- **DAST على الإنتاج: لم يُجرَ.** بيئة التحليل لا تصل إلى `amedeo-ncc.vercel.app`، وأي اختبار نشط يحتاج تفويضًا صريحًا منك. كل «خطوات إعادة الإنتاج» أدناه أوامر تشغّلها أنت، وما كان قابلًا للتحقق محليًا مُعلَّم بـ **[تحقّقتُ محليًا]**.
- لم أشغّل Semgrep/Snyk (لديك نتائج Snyk سابقة).
- **خارج الأرشيف:** قواعد `amedeo-fleet` وكود `ncc-fleet`، إعدادات Firebase Auth، Vercel Dashboard (WAF/Firewall، المتغيرات، السجلات)، صلاحيات GCP IAM، تطبيق Android. أي حكم عليها هنا استدلال من الكود، ومُعلَّم كذلك.
- Docker/Kubernetes: **غير منطبق** (Vercel Serverless + Firebase مُدارة).
- مجلد `.agents/` (مهارة طرف ثالث من `cloudflare/security-audit-skill`) استُبعد من الفحص ولم يُنفَّذ منه شيء.

---

## 4) التفاصيل الفنية والتوصيات

### S-01 — قواعد/تسجيل الدخول على مشروع `amedeo-fleet` (خارج هذا الأرشيف) — **حرج، مشروط**
**الوصف:** الكود هنا (`firebase-fleet.js`, `Admin.vue` تعليق السطر 148) يقول صراحة إن قواعد `amedeo-fleet` تشترط فقط `signedIn()` وليس تطابق بريد الأدمن مثل `firestore.rules` المرفق لموقع الحجز. إن كانت هذه القواعد فعلاً كذلك، فأي مستخدم مُسجَّل دخول على مشروع `amedeo-fleet` (وليس بالضرورة الأدمن) يقرأ ويكتب `prenotazioni`, `employees`, `liveLocations`.
**الخطورة:** حرج (9.1) إن تأكد؛ لا يمكن تخفيضه بدون رؤية الملف الفعلي.
**الأثر المتوقع:** كشف مواقع GPS حيّة للسائقين، بيانات عملاء، تعديل/حذف حجوزات، انتحال حالة سيارة.
**خطوات التحقق (تنفّذها أنت، من Firebase Console → Firestore → Rules لمشروع amedeo-fleet):**
```bash
# أو عبر السطر، بعد firebase login و firebase use amedeo-fleet
firebase firestore:rules:get > fleet.rules
grep -n "signedIn\|isAdmin\|request.auth" fleet.rules
```
**الإصلاح المقترح** (نفس نمط `firestore.rules` الحالي لموقع الحجز، مع تحديد المالك):
```
function isAdmin() {
  return request.auth != null && request.auth.token.email == 'nour2007papa@gmail.com';
}
match /prenotazioni/{id} {
  allow read, write: if isAdmin();
}
match /liveLocations/{id} {
  allow read: if isAdmin();
  allow write: if request.auth != null
    && request.auth.uid == resource.data.driverUid
    && request.resource.data.driverUid == resource.data.driverUid
    && request.resource.data.carId == resource.data.carId;
}
```
(هذا يطابق ما ورد في `/areas/security-review.md` أنك وضعت فيه إصلاحًا مقترحًا بتاريخ 14 سبتمبر لم يُؤكَّد نشره — إن لم يُنشر بعد، هذا هو نفس الالتزام المطلوب الآن.)

---

### S-03 — لوحة الإدارة: عامل واحد للمصادقة + بريد الأدمن ومسار اللوحة داخل الحزمة العامة — **مرتفع**
**الوصف:** `src/Admin.vue:19` و`scripts/init-firestore-config.js` يضعان `nour2007papa@gmail.com` كقيمة افتراضية صلبة، ومسار اللوحة `#gestione-9f3k2x7q` مكتوب في `main.js` و`manifest-gestione.json`. **[تحقّقتُ محليًا]** بعد `vite build`، كلا القيمتين تظهران حرفيًا في `dist/assets/Admin-*.js` و`dist/assets/index-*.js` — أي زائر يفتح "عرض المصدر" أو ملفات الـ dev tools يحصل عليهما مجانًا. الحماية الوحيدة بعدها هي كلمة سر Firebase Auth بعامل واحد (Email/Password)، بلا MFA وبلا Rate Limit مخصص على محاولات الدخول (Firebase يطبّق حدًا افتراضيًا فقط).
**الخطورة:** مرتفع (7.4) — سرّية معرفة الهدف بالكامل (البريد + الرابط)، فقط كلمة السر تحمي وصولًا لهواتف كل العملاء وإمكانية حذفهم.
**الأثر المتوقع:** Credential stuffing / تخمين كلمة سر يعطي تحكمًا كاملًا بالحجوزات ويكشف أرقام هواتف (زر "تصدير الأرقام" في `/areas/booking-site.md`).
**إعادة الإنتاج [تحقّقتُ محليًا]:**
```bash
cd vue-project-v2 && npx vite build
grep -o "nour2007papa@gmail.com" dist/assets/Admin-*.js   # يطبع تطابقًا
grep -o "gestione-9f3k2x7q" dist/assets/index-*.js        # يطبع تطابقًا
```
**الإصلاح:**
1. تفعيل **MFA (Multi-Factor)** على حساب Firebase Auth الخاص بالأدمن (SMS أو TOTP) — من Firebase Console → Authentication → Sign-in method → Multi-factor.
2. نقل التحقق من `email !== ADMIN_EMAIL` (حاليًا Client-side فقط في `Admin.vue:579`) إلى **Firestore Rules** أيضًا (`isAdmin()` موجودة بالفعل هناك وتكفي كحارس فعلي)، والاعتماد على الـ Rules لا على الواجهة كخط دفاع وحيد — هذا مُطبَّق جزئيًا بالفعل عبر `firestore.rules`، لكن مسار `amedeo-fleet` (S-01) لا يزال الثغرة.
3. اعتبار الرابط السري `#gestione-9f3k2x7q` **غير سرّي فعليًا** بعد أول `build` عام؛ إن أردت طبقة عزل إضافية بسيطة وسريعة:
```js
// vercel.json — يضيف Basic Auth أمام نفس الـ hash-route لن يعمل (hash لا يصل للسيرفر).
// البديل العملي: middleware.js على نمط ما فعلته في ncc-fleet (Basic Auth)
// مطبّق على المسار بالكامل غير مناسب هنا لأن index.html نفسه مشترك مع الجمهور.
// الخيار الأنسب: الاكتفاء بـ MFA + مراقبة تسجيلات الدخول الفاشلة (Firebase Console → Authentication → Usage).
```

---

### S-02 — إنشاء `bookings` مفتوح للجميع بلا App Check + تحقق حقول جزئي — **متوسط**
**الوصف:** `firestore.rules:15-59` تسمح لأي زائر غير مسجّل (`request.auth == null`) بإنشاء وثيقة `bookings` طالما توفّرت الحقول المطلوبة والقيم المسموحة. **لا يوجد Firebase App Check** في أي ملف بالمشروع (تحقّقتُ بـ `grep -r "app-check\|AppCheck"` — بلا نتائج)، ولا **reCAPTCHA**؛ الحماية الوحيدة هي حقل honeypot نصي (`BookingForm.vue` حقل `website`) الذي يوقف بوتات بدائية فقط، لا سكربتات موجّهة.
كذلك القاعدة تتحقق من طول `name`/`phone`/`details`/`zona`/`destinazione`/`volo` لكن **لا تتحقق من طول/نوع** `service`, `serviceDate`, `country`, `people`, `flight`, `hotel`, `bags` رغم أنها ضمن `hasOnly` — يمكن إرسال قيم بأي طول لهذه الحقول (حتى حد 1MB في `_rateLimit`، لكن هذا لا ينطبق على كتابة Firestore SDK من المتصفح، فقط على `api/*`).
**الخطورة:** متوسط (6.5).
**الأثر المتوقع:** حجوزات سبام تفتح تذاكر "نجاح" وهمية للعميل، تكلفة قراءة/كتابة Firestore، تلويث لوحة الأدمن، واحتمال إرسال نصوص طويلة جدًا في حقول غير محدودة الطول إلى `sync-pending` ثم إلى لوحة `ncc-fleet`.
**إعادة الإنتاج (نظريًا، عبر Firestore Web SDK بدون مرور بالنموذج):**
```js
// من console المتصفح على أي صفحة تحمّل firebase/app + firebase/firestore بنفس الإعداد العام
import { addDoc, collection, getFirestore } from "firebase/firestore";
await addDoc(collection(db, "bookings"), {
  name: "x", phone: "1", createdAt: serverTimestamp(), confirmed: false,
  editToken: "00000000000000000000000000000000".slice(0,32),
  service: "A".repeat(50000) // غير محدود الطول في الـ rules
});
```
**الإصلاح:**
1. تفعيل **App Check** (reCAPTCHA v3 أو Enterprise) على `amedeo-ncc` وربطه بقاعدة `bookings`:
```js
// src/firebase.js
import { initializeAppCheck, ReCaptchaV3Provider } from "firebase/app-check";
export const appCheck = initializeAppCheck(app, {
  provider: new ReCaptchaV3Provider(import.meta.env.VITE_RECAPTCHA_SITE_KEY),
  isTokenAutoRefreshEnabled: true,
});
```
```
// firestore.rules — إضافة الشرط
&& request.auth == null
&& request.resource.data.keys().hasOnly([...])
// Firebase يتحقق من App Check تلقائيًا إن فُعِّل enforcement من Console (Firestore → App Check → Enforce)
```
2. تحديد طول لكل حقل نصي متبقٍّ:
```
&& request.resource.data.service is string && request.resource.data.service.size() <= 60
&& request.resource.data.serviceDate is string && request.resource.data.serviceDate.size() <= 40
&& request.resource.data.country is string && request.resource.data.country.size() <= 6
&& request.resource.data.people is string && request.resource.data.people.size() <= 5
&& request.resource.data.flight is string && request.resource.data.flight.size() <= 20
&& request.resource.data.hotel is string && request.resource.data.hotel.size() <= 120
&& request.resource.data.bags is string && request.resource.data.bags.size() <= 5
```

---

### S-04 — `/api/booking-edit` يبقى حيًّا رغم أن ميزة تعديل/إلغاء الحجز مُعطَّلة من الواجهة — **✅ مغلق (22 سبتمبر 2026)**
**القرار المتخذ:** التعديل بعد الحجز يتم فقط من لوحة الأدمن (`Admin.vue` عبر `isAdmin()`) — لا مسار للعميل من الأساس، لا مؤقت ولا دائم. `api/booking-edit.js` عُطِّل نهائيًا من السيرفر (`410 feature_disabled`)، `src/Modifica.vue` حُذف من المستودع، والمسار `isEditRoute`/`#modifica-{id}-{token}` أُزيل من `main.js`. `firestore.rules` لم يحتج تعديلًا (كان بالفعل مقصورًا على `isAdmin()` فقط).
**الوصف الأصلي (للسجل):** حسب `/areas/booking-site.md`، ألغيتَ استخدام `Modifica.vue`/`booking-edit.js` في 21 سبتمبر (توقّف إرسال الرابط عبر واتساب). لكن **[تحقّقتُ محليًا]** الملف `api/booking-edit.js` ما زال موجودًا وقابلًا للاستدعاء، و`Modifica.vue` ما زال مبنيًا في الحزمة (`dist/assets/Modifica-*.js`, `Modifica-*.css`)، والمسار `#modifica-{id}-{token}` في `main.js:80` ما زال مُفعَّلًا.
أي حجز قديم لم يُحذف من Firestore ولا يزال يحمل `editToken` (كل الحجوزات القديمة تحمله لأنه إلزامي في `firestore.rules`) **قابل للتعديل أو الإلغاء** من أي من امتلك الرابط القديم على واتساب، إلى ما لا نهاية، دون أن يظهر ذلك في أي مكان بالواجهة الحالية.
**الخطورة:** متوسط (4.8) — يتطلب معرفة رابط قديم صالح (32 حرفًا هيكس، غير قابل للتخمين عمليًا)، لكن المشكلة الحقيقية تشغيلية: وظيفة موقوفة "من الواجهة" فقط وليست من السيرفر، وهذا مخالف لمبدأ "الحد الأدنى من التعرض".
**الأثر المتوقع:** عميل قديم (أو من سرّب له الرابط سهوًا) يعدّل/يلغي حجزًا دون علم الأدمن، بينما يعتقد الفريق أن الميزة معطّلة بالكامل.
**إعادة الإنتاج:**
```bash
# لأي bookingId/editToken قديمين معروفين (32 حرفًا):
curl "https://amedeo-ncc.vercel.app/api/booking-edit?bookingId=<ID>&token=<TOKEN>"
# يعيد 200 مع تفاصيل الحجز إن كان لا يزال ضمن نافذة الـ 6 ساعات
```
**الإصلاح (اختر واحدًا حسب النية):**
- إن كان الإيقاف نهائيًا: احذف `api/booking-edit.js` و`src/Modifica.vue` والفرع `isEditRoute` في `main.js` بالكامل، أو على الأقل أوقف الدالة من السيرفر:
```js
// أعلى handler في api/booking-edit.js
export default async function handler(req, res) {
  res.status(410).json({ error: 'feature_disabled' });
  return;
}
```
- إن كان الإيقاف مؤقتًا فقط لمشكلة عرض رقم الرخصة (كما ورد في booking-site.md كـ "deferred"): أبقِ الكود لكنه يجب أن يُعامَل كنشِط أمنيًا (يبقى ضمن نطاق أي تدقيق قادم)، ولا يُعتبر "معطّلًا".

---

### S-05 — `sync-webhook`: قابلية إعادة التشغيل (Replay) وتوقيع على تسلسل JSON غير حتمي — **متوسط**
**الوصف:** `verifyWebhookSignature` (`api/sync-webhook.js:28-65`) تحسب `JSON.stringify(req.body)` ثم HMAC-SHA256 وتقارنها بـ`timingSafeEqual` — وهذا سليم للمقارنة نفسها. لكن هناك ثغرتان تصميميتان:
1. **لا nonce ولا timestamp** في التوقيع، فأي طلب مُلتقَط (مثلاً عبر لوج شبكة أو وسيط) قابل للإرسال ثانية بلا حد زمني، وسيُقبل دائمًا لأن التوقيع لا يتغيّر مع الزمن.
2. `JSON.stringify` على جسم مُفكَّك ومُعاد تجميعه بواسطة Vercel/Node **غير مضمون أن يطابق البايتات الأصلية** التي وقّع عليها المُرسِل (ترتيب المفاتيح، الفراغات) — إن كان المُرسِل (Cloud Function) يبني JSON بترتيب مختلف عن ترتيب تحليل V8 لنفس الكائن، ستفشل التحققات الصحيحة أحيانًا (مشكلة موثوقية أكثر منها أمنية، لكنها تكشف أن التوقيع لا يُحسَب على raw body الحقيقي).
كما لاحظتُ عبر البحث في المستودع (`grep -rn "sync-webhook"`) أنه **لا يوجد أي مستدعٍ فعلي** لهذا الـ endpoint داخل هذا الأرشيف (لا Cloud Function تستدعيه) — أي أنه إما يُستدعى من كود خارج هذا المستودع (GCP Cloud Functions منفصلة، غير مرئية لي)، أو أنه غير مستخدم حاليًا وموجود فقط كواجهة جاهزة.
**الخطورة:** متوسط (5.9)، مشروط بسريّة `SYNC_WEBHOOK_SECRET` (مؤكدة مضبوطة في Production حسب `security-review.md`).
**الأثر المتوقع:** لو تسرّب السر أو التقط أحد طلبًا صالحًا، يمكنه تكراره لإنشاء/تعديل وثائق أسطول وهمية بلا حد زمني.
**الإصلاح:**
```js
// إرسال timestamp في الهيدر من جهة الـ Cloud Function المرسِلة، والتحقق هنا:
const timestamp = req.headers['x-webhook-timestamp'];
const MAX_SKEW_MS = 5 * 60 * 1000;
if (!timestamp || Math.abs(Date.now() - Number(timestamp)) > MAX_SKEW_MS) {
  return res.status(401).json({ error: 'stale_or_missing_timestamp' });
}
// وضمّ الـ timestamp داخل الرسالة الموقَّعة:
const payload = `${timestamp}.${rawBodyString}`;
const expectedSignature = crypto.createHmac('sha256', WEBHOOK_SECRET).update(payload).digest('hex');
```
```js
// لضمان توقيع raw body الحقيقي بدل JSON.stringify(req.body) المُعاد بناؤه،
// في vercel.json أضف config لتعطيل bodyParser على هذا المسار فقط واقرأ raw:
export const config = { api: { bodyParser: false } };
// ثم في handler اقرأ req كـ stream وحوّله لنص قبل JSON.parse، ووقّع على ذلك النص بالذات.
```

---

### S-06 — مفاتيح Service Account طويلة الأمد بصلاحيات افتراضية — **متوسط**
**الوصف:** `SITE_SERVICE_ACCOUNT_KEY` و`FLEET_SERVICE_ACCOUNT_KEY` (Base64 لملفات JSON) تُستخدم في ثلاث دوال (`sync-pending`, `sync-webhook`, `booking-edit`) بصلاحيات Admin SDK الكاملة (لا حدود IAM مخصصة مذكورة). هذا النمط شائع لكنه يعني أن أي تسريب لأحد المتغيرين (log خاطئ، متغير بيئة Preview مكشوف بالخطأ، إلخ) يعطي تحكمًا كاملًا بقاعدة بيانات كاملة بلا تدوير تلقائي.
**الخطورة:** متوسط (~5.0) — احتمالية منخفضة (تحقّقتَ فعليًا أن هذه المتغيرات ليست في Preview حسب سجل المحادثات) لكن الأثر عالٍ إن حدث.
**الأثر المتوقع:** سيطرة كاملة على القراءة/الكتابة/الحذف في `amedeo-ncc` أو `amedeo-fleet`.
**التوصية:**
1. التأكد الدوري (كل 3 أشهر) أن هذين السرّين مضبوطان **Production فقط** وليس Preview/Development على Vercel (`vercel env ls`).
2. النظر في Service Account IAM مقيّد (Firestore User فقط بدل Owner) من GCP Console → IAM.
3. جدولة تدوير المفاتيح كل 6–12 شهرًا (Firebase Console → Project Settings → Service Accounts → Generate new private key، ثم تعطيل القديم).

---

### S-07 — بيانات شخصية دائمة في `localStorage` للزوّار + طلبات لأطراف ثالثة مقابل نص "cookies تقنية فقط" — **متوسط (امتثال)**
**الوصف:** `sync-utils.js` (`SyncQueueManager`) يخزّن في `localStorage` المفتاح `amedeoBookingSyncQueue` (من جهة الزائر عبر `BookingForm.vue:317`) نسخة كاملة من بيانات الحجز — **الاسم، الهاتف، الوجهة، تفاصيل الرحلة** — بلا انتهاء صلاحية، حتى بعد نجاح المزامنة فعليًا (`clearCompleted()` يُستدعى فقط عند نجاح استجابة `/api/sync-pending`، فإن فشلت الشبكة تبقى البيانات في المتصفح إلى الأبد). النص القانوني في `i18n.js` (`cookie_text`, `privacy_p4`) يذكر صراحة: **"نستخدم فقط الكوكيز التقنية الضرورية… لا يوجد تتبع أو كوكيز طرف ثالث"** — بينما الصفحة تحمّل فعليًا فيديو من `res.cloudinary.com`، خرائط من `openstreetmap.org` (iframe)، وخطوطًا من Google Fonts، وكلها اتصالات لأطراف ثالثة (ليست كوكيز بالمعنى الحرفي، لكنها قد تُصنَّف كمعالجة بيانات لطرف ثالث بحسب GDPR الصارم، خصوصًا الخريطة المُضمَّنة التي قد تُسجِّل IP الزائر).
**الخطورة:** متوسط من زاوية الامتثال لا الاستغلال التقني (~4.0) — لا CVSS كلاسيكي هنا لأنها ليست ثغرة تقنية بل تعارض بين الممارسة والنص القانوني المعروض للمستخدم.
**الأثر المتوقع:** شكوى GDPR محتملة، أو طلب "الحق في المحو" (Art. 17) لا يمكن تلبيته لأن نسخة من البيانات باقية في متصفح الزائر نفسه (خارج سيطرة الشركة أصلًا، لكن كونها "مُصدَّرة" هناك من موقعكم يزيد الحساسية).
**التوصية:**
1. إضافة TTL على `localStorage`: امسح أي عملية أقدم من 24 ساعة بغض النظر عن نجاحها:
```js
// sync-utils.js — في loadQueue()
const MAX_AGE_MS = 24 * 60 * 60 * 1000;
return raw ? JSON.parse(raw).filter(op => Date.now() - op.queuedAt < MAX_AGE_MS) : [];
```
2. تحديث `privacy_p4`/`cookie_text` (في `i18n.js`، ثلاث لغات) ليذكر صراحة: تخزين محلي مؤقت للمزامنة، وخريطة/فيديو من أطراف ثالثة (Cloudinary, OpenStreetMap).

---

### S-08 — تشديد إضافي على CSP والرؤوس — منخفض
**الوصف:** `vercel.json` جيدة جدًا فعلًا (Trusted Types, HSTS مع preload, frame-ancestors 'none'). النقطتان المتبقيتان: `style-src 'unsafe-inline'` (موثّق في `security-review.md` أنك تعرف بها وتؤجلها)، و`connect-src` يتضمن `wss:` بلا نطاق محدد (يسمح بأي WebSocket عبر HTTPS إلى أي مضيف).
**التوصية:** إن لم تكن هناك حاجة فعلية لـ WebSocket عام، قيّد `connect-src` إلى نطاقات Firebase فقط دون `wss:` المفتوح؛ و`style-src 'unsafe-inline'` يبقى معروفًا ومقبولًا مؤقتًا حسب قرارك السابق.

---

### S-09 — تصميم Rate Limiting: استثناءات غير معالجة و`X-Forwarded-For` غير مُنظَّف — منخفض
**الوصف:** `security-middleware.js:96-97` يأخذ `req.headers['x-forwarded-for']` مباشرة كمعرّف IP بلا تحقق من الصيغة، وقد يحتوي على قائمة IPs مفصولة بفواصل (السلوك الطبيعي خلف عدة وكلاء) — القيمة الكاملة (وليس أول IP فقط) تُستخدم كمفتاح، مما **يُضعف** فعالية الحد لأنها تصبح شبه فريدة لكل طلب في بعض تكوينات الوكيل بدل تجميع نفس الزائر. أيضًا استثناء `upstashCommand` مغطّى بـ try/catch في `rateLimit` فقط، لكن فشل شبكي متكرر لـ Upstash يرجع بصمت لـ in-memory الذي "يُصفَّر" مع كل cold start — سلوك موثَّق ومقصود لكنه يعني أن الحد الفعلي وقت الأحمال العالية أضعف مما تُظهره الأرقام.
**التوصية:**
```js
const clientIp = (req.headers['x-forwarded-for'] || req.headers['x-real-ip'] || 'unknown')
  .split(',')[0].trim();
```

---

### S-10 — نظافة سلسلة التوريد — منخفض
**الوصف [تحقّقتُ محليًا]:** `npm ci --ignore-scripts` + `npm audit` = **0 ثغرات** (info/low/moderate/high/critical كلها صفر) على التبعيات الحالية (`firebase ^12.16`, `firebase-admin ^14.3`, `vue ^3.4`, `vite ^8.2.1`). البناء (`vite build`) لا يُخرج أي `.map` في `dist/`. لا مفاتيح API أو أسرار حقيقية داخل المستودع (فحص أنماط Google/AWS/Stripe/Slack/JWT شامل، سلبي). النقطة الوحيدة: `puppeteer` (كامل، وليس `-core`) موجود في `devDependencies` وحده ~300 م.ب مع Chromium مُدمَج — مقصود للتطوير المحلي فقط (`scripts/prerender.js` يستخدم `@sparticuz/chromium` + `puppeteer-core` فقط على Vercel)، فلا أثر أمني لكنه يُبطئ `npm ci` محليًا.
**التوصية:** لا إجراء عاجل؛ فحص `npm audit` دوري (شهري) كافٍ حاليًا.

---

### S-11 — لا IP Whitelisting على المسارات الحساسة — منخفض
**الوصف:** `api/sync-webhook.js` و`api/booking-edit.js` (ومستقبلًا أي endpoint إداري) مفتوحة لأي عنوان IP طالما توفّر التوقيع/التوكن الصحيح. هذا مقبول حاليًا لأن الحماية الأساسية (HMAC على sync-webhook، وطول التوكن 32 حرفًا على booking-edit) كافية، لكن طبقة IP Whitelisting تقلّل سطح الهجوم لو كان مصدر الاستدعاء ثابتًا معروفًا (مثلًا Cloud Function بعنوان IP خارجي ثابت لـ sync-webhook).
**الخطورة:** منخفض (~3.5) — طبقة دفاع إضافية لا ثغرة قائمة.
**التوصية:**
```js
// middleware.js أو أعلى الـ handler، لمسارات محدّدة فقط
const ALLOWED_IPS = (process.env.SYNC_ALLOWED_IPS || '').split(',');
const clientIp = (req.headers['x-forwarded-for'] || '').split(',')[0].trim();
if (ALLOWED_IPS.length && !ALLOWED_IPS.includes(clientIp)) {
  return res.status(403).json({ error: 'forbidden_ip' });
}
```
يُطبَّق فقط إن كان عنوان الـ Cloud Function المرسِلة لـ `sync-webhook` ثابتًا (تحقّق من GCP)؛ غير مناسب لـ `booking-edit` لأن العملاء يفتحونه من أي مكان.

---

### T-01 — نظام المزامنة يعتمد على تبويب الأدمن المفتوح + سباق ينتج وثائق أسطول مكررة — **مرتفع**
**الوصف:** جزء من مسار المزامنة (`listenForFleetStatusUpdates`, `flushFleetSyncQueue`, `initializeEnhancedSync` في `Admin.vue`) **يعمل فقط بينما متصفح الأدمن مفتوح ومُسجَّل دخول على مشروعي Firebase معًا**. إن أُغلق التبويب، أي حجز جديد لا يزال يُزامن عبر `api/sync-pending.js` (سيرفر، مستقل) — هذا جيد كخط أول. لكن مزامنة **الحالة الراجعة من الأسطول** (تعيين سائق، إنهاء رحلة) تمرّ فقط عبر `listenForFleetStatusUpdates` في `Admin.vue` من جهة العميل، **لا يوجد لها نظير سيرفر-إلى-سيرفر مضمون التشغيل** بشكل مستقل عن كون الأدمن مسجّلًا دخوله في تلك اللحظة (يوجد `sync-webhook.js` كبديل لكن لا مستدعٍ فعلي مرئي له في هذا الأرشيف — انظر S-05).
إضافة لذلك، **[تحقّقتُ من الكود، لم أُنفّذه]** كل من `sync-pending.js` (مسار الإنشاء الأول للحجز) و`Admin.vue:338-369` (مسار تأكيد الأدمن اليدوي) يحتويان منطقًا منفصلًا لإنشاء وثيقة `prenotazioni` **وكلاهما يتحقق من `fleetDocId` قبل الإنشاء لتفادي التكرار** — لكن التحقق في `sync-pending.js` يستخدم `runTransaction` (آمن من السباق) بينما التحقق في `Admin.vue:369` (`await updateDoc(bookingRef, { fleetDocId: fleetDoc.id })`) **بلا transaction** — إن ضغط الأدمن على "تأكيد" مرتين بسرعة (نقرة مزدوجة عرضية، أو تبويبان مفتوحان)، يمكن إنشاء وثيقتي `prenotazioni` لنفس الحجز.
**الخطورة:** مرتفع تشغيليًا (لا CVSS لأنه ليس ثغرة استغلال، بل عيب اعتمادية).
**الأثر المتوقع:** سائق يرى نفس الرحلة مرتين، أو حجز "يختفي" من متابعة الأسطول لأن التحديث الراجع لم يصل بسبب إغلاق تبويب الأدمن في تلك اللحظة.
**الإصلاح:**
1. لمنع التكرار في `Admin.vue`، لُف الإنشاء والتحديث في `runTransaction` بنفس نمط `sync-pending.js`:
```js
await db.runTransaction(async (tx) => {
  const fresh = await tx.get(bookingRef);
  if (fresh.data()?.fleetDocId) return; // تم الإنشاء بالفعل من مكان آخر
  const fleetDoc = doc(collection(fleetDb, 'prenotazioni'));
  tx.set(fleetDoc, { /* ... */ });
  tx.update(bookingRef, { fleetDocId: fleetDoc.id });
});
```
2. لضمان أن تحديث الحالة الراجعة (تعيين سائق/إنهاء رحلة) لا يعتمد على تبويب أدمن مفتوح: فعّل **Cloud Function** حقيقية (Firestore Trigger على `prenotazioni`) بدل الاعتماد على `sync-webhook.js` الذي لا مستدعٍ ظاهرًا له، أو وثّق بوضوح أن `sync-webhook.js` هو ذلك الـ Trigger الفعلي المنشور خارج هذا المستودع (إن كان كذلك، فلا حاجة لعمل إضافي هنا سوى التأكيد الكتابي في `PROJECT.md`).

---

### T-02 — لا نسخ احتياطي موثّق، حذف نهائي فوري، DLQ بلا مستهلك — **متوسط (مرتفع إن غاب PITR)**
**الوصف:** `Admin.vue:1099` (`deleteBooking`) يحذف الوثيقة نهائيًا (`deleteDoc`) بعد `confirm()` بسيط في المتصفح — لا سلة محذوفات، لا soft-delete. لا وجود لأي إشارة إلى **Point-in-Time Recovery** أو نسخ احتياطي مجدول لـ Firestore في أي ملف بالمشروع أو في `PROJECT.md`. إضافة إلى ذلك، `sync_dead_letter_queue` (`sync-webhook.js:252-263`) تُملأ عند فشل المزامنة لكن **[تحقّقتُ بالبحث في كامل المستودع]** لا يوجد أي كود يقرأ منها أو يعالجها — فهي تتراكم بصمت بلا تنبيه ولا إعادة محاولة تلقائية.
**الخطورة:** متوسط افتراضيًا (يرتفع لمرتفع إن كان Firestore PITR غير مفعّل من GCP Console — هذا خارج الأرشيف، تحقّق بنفسك).
**الأثر المتوقع:** حذف خاطئ لحجز = فقدان دائم؛ فشل مزامنة متكرر يبقى غير مرئي لأحد.
**التوصية:**
1. تفعيل **Point-in-Time Recovery** على `amedeo-ncc` و`amedeo-fleet` من GCP Console → Firestore → Backups (استرجاع حتى 7 أيام).
2. تحويل الحذف إلى soft-delete:
```js
async function deleteBooking(b) {
  if (!confirm(...)) return;
  await updateDoc(doc(db, 'bookings', b.id), { deleted: true, deletedAt: new Date().toISOString() });
  // حذف فعلي دوري (Cloud Function Scheduled) بعد 30 يومًا
}
```
3. صفحة بسيطة (أو زر) في `Admin.vue` تعرض عدد وثائق `sync_dead_letter_queue` وتسمح بإعادة المحاولة اليدوية، أو Cloud Function مجدولة (كل ساعة) تعالجها تلقائيًا.

---

### T-03 — عيوب وظيفية في التحقق من المُدخلات — **✅ مغلق جزئيًا (22 سبتمبر 2026)**
**ما تم:** `validateFlightNumber` أُصلحت في `validation.js` (`^[A-Z0-9]{2}\d{1,4}$/i`) — تقبل الآن أكواد IATA حرف+رقم (easyJet `U2`, Wizz `W6`, إلخ). `sanitizeInput` (تشويه `<b>` → `bهتوb`) **لم يُصلَح بعد** — يبقى P1 مفتوح.
**الوصف الأصلي [تحقّقتُ محليًا بتشغيل الدالة فعليًا]:**
```
validateFlightNumber("AZ1234") → true   ✅ آليتاليا القديم
validateFlightNumber("U28451") → false  ❌ easyJet (كود شركة حرف واحد + رقم)
validateFlightNumber("W64321") → false  ❌ Wizz Air
validateFlightNumber("3O1234") → false  ❌ أي كود يبدأ برقم
```
التعبير النمطي `^[A-Z]{2}\d{3,4}$` في `validation.js:190-193` يفترض دائمًا حرفين لاتينيين، بينما عدة شركات طيران رخيصة شائعة على خط ميلانو (easyJet=U2, Wizz=W6, Vueling=VY لكن أيضًا رموز بحرف+رقم مثل beyond) تستخدم رمز IATA بصيغة حرف+رقم. **الأثر: عميل حقيقي قادم على رحلة easyJet لا يستطيع إدخال رقم رحلته الصحيح، فيُضطر لتركه فارغًا أو يُرفض الحجز بصمت.**
كذلك `sanitizeInput` (`validation.js:160-167`) **[تحقّقتُ محليًا]** يحوّل `<b>` إلى `b` فقط (يحذف `<` و`>` دون حذف اسم الوسم)، فيُدرِج كلمات غريبة داخل النص المُخزَّن (`Mario Rossi, <b>hotel</b> Onorio` → `Mario Rossi, bhotel/b Onorio`) — لا يشكّل هذا ثغرة (لا XSS لأن Vue يُخرج نصًا لا HTML في كل مكان يُعرض فيه هذا الحقل)، لكنه يُشوّه بيانات حقيقية للعملاء الذين يستخدمون `<`/`>` بغرض آخر (نادر لكنه يُربك القراءة في لوحة الأدمن).
**الإصلاح:**
```js
// validation.js
export function validateFlightNumber(flight) {
  if (!flight) return true;
  // يدعم كود شركة من حرفين (AZ) أو حرف+رقم (U2, W6) + 1-4 أرقام واختياري حرف لاحقة
  const flightRegex = /^[A-Z][A-Z0-9]\d{1,4}[A-Z]?$/i;
  return flightRegex.test(flight.trim());
}

export function sanitizeInput(input) {
  if (typeof input !== 'string') return '';
  return input
    .replace(/<[^>]*>/g, '')      // يحذف الوسم كاملًا بدل الأقواس فقط
    .replace(/javascript:/gi, '')
    .replace(/on\w+=/gi, '')
    .trim();
}
```

---

### T-04 — مشاكل SEO: عدم اتساق `www.` والنطاق الحالي، `robots.txt` بقواعد غير قياسية — **متوسط**
**الوصف [تحقّقتُ محليًا من الملفات]:**
- `index.html` وكل `hreflang`/`canonical`/Schema.org و`sitemap.xml` تشير إلى `https://www.amedeo-ncc.vercel.app` — لكن `firestore.rules`, `AeroportoPage.vue`, `Admin.vue` تشير إلى `https://amedeo-ncc.vercel.app` **بدون www**. النطاق الفرعي `www.amedeo-ncc.vercel.app` **غالبًا لا يُشير إلى أي شيء فعليًا** (Vercel لا يُنشئ تلقائيًا نطاق `www` فرعيًا على `*.vercel.app`) — فكل روابط canonical/sitemap/hreflang قد تكون **مكسورة فعليًا** الآن، مما يُبطل جزءًا كبيرًا من عمل الـ prerender وSEO المُنجز.
- `public/robots.txt:299-300` يحتوي `Allow: /public/` و`Allow: /assets/` وهذان **ليسا مسارين حقيقيين** على الموقع المبني (Vite يخرج كل شيء تحت `/assets/` مباشرة على الجذر بلا `/public/` كبادئة — تحقّقتُ من `dist/` أعلاه) — سطرا `Allow` هذان بلا ضرر لكن بلا فائدة، وأهم من ذلك: **لا يوجد `Sitemap:` إشارة صحيحة** لأن الرابط فيها يشير أيضًا لنطاق `www.` المشكوك في صحته.
**الأثر المتوقع:** محركات البحث قد لا تفهرس الصفحات بلغاتها الثلاث بشكل صحيح، ويضيع أثر عمل الـ prerender (`scripts/prerender.js`) الذي هدفه بالتحديد تحسين هذا الجانب.
**التحقق المطلوب منك (بسيط):**
```bash
curl -I https://www.amedeo-ncc.vercel.app
curl -I https://amedeo-ncc.vercel.app
```
**الإصلاح:** إن أكّد الفحص أن `www.` لا يعمل، استبدل كل تكرارات `www.amedeo-ncc.vercel.app` بـ `amedeo-ncc.vercel.app` في: `index.html`, `public/sitemap.xml`, `public/robots.txt` (سطر Sitemap)، دفعة واحدة:
```bash
grep -rl "www.amedeo-ncc.vercel.app" index.html public/sitemap.xml public/robots.txt \
  | xargs sed -i 's/www\.amedeo-ncc\.vercel\.app/amedeo-ncc.vercel.app/g'
```
(هذا يصبح غير ضروري تلقائيًا بمجرد ربط دومين مخصص، لكنه يستحق الإصلاح الآن لتفادي فهرسة خاطئة في الفترة الانتقالية.)

---

### T-05 — ملاحظات أداء صغيرة — منخفض
- `App.vue` يُحمّل Firebase (`firebase/app` + `firebase/firestore`) بشكل كسول فقط عند أول تفاعل حقيقي مع النموذج (جيد جدًا، **[تحقّقتُ]** من `App.vue:24-34`)، لكن `Admin.vue` (المُحمَّل فقط للأدمن أصلًا، فلا أثر على الزوّار) يستورد Firebase بشكل مباشر ثابت — لا مشكلة لأنه محمَّل بالفعل بشكل كسول عبر `main.js`.
- `useVersionCheck` (`composables/useVersionCheck.js`) يعمل `fetch` كل 60 ثانية طوال بقاء الصفحة مفتوحة — استهلاك شبكة صغير مستمر؛ يمكن رفعه إلى 5 دقائق بلا أثر عملي محسوس على تجربة "نسخة جديدة متاحة".
- Region الدوال الصرفية (`api/*.js`) لم يُحدَّد صراحة في `vercel.json` (لا `regions` key) — Vercel سيستخدم المنطقة الافتراضية لحسابك؛ للسيدة الحصول على أقل زمن استجابة من ميلانو، حدّد صراحة `fra1` أو `cdg1` إن لم تكن مضبوطة بالفعل من Dashboard.

---

### T-06 — جودة الكود والصيانة — منخفض
**الوصف [تحقّقتُ بالعدّ]:** `Admin.vue` (57KB / ~1400 سطر تقريبًا)، `App.vue` (64KB)، `BookingForm.vue` (33KB) — مكوّنات ضخمة تجمع منطق مصادقة + مزامنة + واجهة + i18n في ملف واحد، مما يصعّب المراجعة والاختبار. **لا يوجد أي ملف اختبار** (`*.test.js`/`*.spec.js`) في كامل الأرشيف، **لا CI** (`.github/workflows` غائب)، **لا ESLint/Prettier config**. هذا يعني أن كل الإصلاحات المذكورة أعلاه (بما فيها إصلاحات مؤرَّخة سابقًا في `SECURITY_AUDIT_2026-08-31.md` و`CHANGELOG.md`) تعتمد كليًا على المراجعة اليدوية دون شبكة أمان آلية تمنع الرجوع (regression).
**التوصية (لا استعجال، لكنها الأثر الأكبر على المدى المتوسط):**
1. تقسيم `Admin.vue` إلى: `useAuth.js` (تسجيل الدخول)، `useFleetSync.js` (كل منطق المزامنة الحالي المبعثر بين `sync-utils.js`/`sync-orchestrator.js`/الكود المضمّن)، ومكوّن عرض خالص.
2. إضافة ESLint بالحد الأدنى (`eslint-plugin-vue`) لالتقاط أخطاء بسيطة (متغيرات غير مستخدمة، `console.log` متروكة في الإنتاج — يوجد عشرات منها حاليًا في `sync-orchestrator.js`/`sync-utils.js`).
3. اختبار وحدة واحد على الأقل لكل دالة تحقق في `validation.js` — كانت كافية لاكتشاف عيوب T-03 قبل النشر.

---

## 5) خطة العلاج المُقترحة (بالأولوية)

| الأسبوع | البنود |
|---|---|
| **الآن (قبل أي إعلان/دومين جديد)** | S-01 (تحقّق فوري من قواعد fleet) → S-03 (MFA) → S-02 (App Check) → ~~S-04~~ ✅ → T-01 (transaction في Admin.vue) |
| **خلال أسبوعين** | S-05, S-06 (تأكيد دوري), T-02 (PITR + soft-delete), T-03 (✅ regex مُصلَح — `sanitizeInput` لا يزال مفتوحًا) |
| **خلال شهر** | T-04 (SEO www)، S-07 (TTL على localStorage + تحديث نص الخصوصية)، S-08/S-09 (تحسينات CSP وRate Limit)، S-11 (IP Whitelisting إن كان مصدر sync-webhook ثابتًا) |
| **مستمر/اختياري** | S-10 (فحص دوري)، T-05، T-06 (إعادة هيكلة + اختبارات + CI) |

## سجل الإغلاقات
| البند | تاريخ الإغلاق | الملفات المعدَّلة |
|---|---|---|
| S-04 | 22 سبتمبر 2026 | `api/booking-edit.js` (تعطيل 410)، `src/main.js` (حذف isEditRoute)، `src/Modifica.vue` (محذوف) |
| T-03 (جزء regex) | 22 سبتمبر 2026 | `validation.js` (`validateFlightNumber`) — `sanitizeInput` لا يزال مفتوحًا |

**الخطوة التالية:** التالي بالأولوية هو S-01 (التحقق من قواعد `amedeo-fleet` — حرج مشروط) — نبدأ فيه؟

