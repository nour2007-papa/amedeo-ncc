# CHANGELOG — Grifone NCC (amedeo-ncc)

سجل موحّد لكل جلسات العمل على المشروع. كل جلسة جديدة تُضاف كقسم جديد في الأعلى (الأحدث أولًا).

---

## 2026-09-17 — إصلاح CSP + تحسين أداء

### المشكلة الأصلية
فحص الأمان (Security Checks) أظهر فشل CSP بسبب `'unsafe-inline'` في `style-src`.

### التعديلات المطبّقة (بالترتيب الزمني)

**أ. `src/Admin.vue` + `public/admin.css`**
- استُبدل inline style في textarea تصدير الأرقام (`style="width:100%; resize:vertical; font-family:monospace;"`)
- بكلاس جديد `.admin-export-textarea` مُعرّف في `admin.css`، بدون المساس بالكلاس المشترك `.admin-driver-input`.
- Commit: `5cb5f88` — نجح، تأكيد بصري على الموبايل.

**ب. `vercel.json` — محاولة إزالة `unsafe-inline`**
- أُزيلت `'unsafe-inline'` من `style-src` في الـ CSP الرئيسي.
- النتيجة: ظهرت 3 CSP violations فعلية في الموقع الحي، مصدرها:
  - `--fab-shift` في `App.vue` (زرار واتساب العائم، `document.documentElement.style.setProperty`)
  - `--griffin-float` في `App.vue` (صورة الـ hero، بتتحرك مع السكرول)
- السبب: القيم دي مستمرة (continuous) مش ثابتة — لا تصلح لها hash ولا nonce ثابت.

**ج. القرار النهائي (موثّق ومتعمّد)**
- تراجعنا عن إزالة `unsafe-inline` ورجّعناها إلى `style-src` فقط (باقي الـ CSP سليم وصارم: `script-src`, `object-src 'none'`, `frame-ancestors 'none'`, إلخ).
- Commit: `ecd2d64` — "revert(security): restore unsafe-inline in style-src (dynamic CSS custom properties incompatible with static hash/nonce)"
- السبب: الفايدة الأمنية من إزالتها محدودة (CSS-injection risk فقط، مخفّف أصلًا بباقي الـ CSP)، مقابل تحويل معماري حقيقي (خطوات CSS ثابتة بدل px حرة) يحتاج مجهود اختبار كبير مقابل فايدة قليلة.
- النتيجة: Security Score رجع لـ **97/100** (Medium risk موثّق ومقبول)، 19 passed / 1 failed (نفس فحص CSP بسبب `unsafe-inline` المتعمّد).

**د. `index.html` — تحسين أداء بسيط**
- أُضيف `media="(min-width: 901px)"` على preload صورة الـ hero (مخفية أصلًا على الموبايل عبر `display:none`، كانت بتتحمّل بأولوية عالية بلا داعي).
- Commit: `037cf0b`
- النتيجة: تحسّن طفيف (LCP من 4.7s لـ 4.5s على Mobile، السكور من 78 لـ 79).

### تحقيق سبب بطء LCP على Mobile (4.5s)
- تأكّدنا إن lazy loading شغّال بالفعل بشكل جيد (`BookingForm.vue` عبر `defineAsyncComponent`، Firebase محمّل ديناميكيًا فقط عند الحاجة، `main.js` عنده routing نظيف بـ chunks منفصلة).
- تأكّدنا إن مفيش خطوط Google مُحمّلة في الموقع الرئيسي (الأسماء `Fraunces`/`Work Sans` بترجع لخط النظام تلقائيًا).
- الخلاصة: السبب الحقيقي هو معمارية Client-Side Rendering (Vue SPA) نفسها. الحل الحقيقي يحتاج SSR/Prerendering — تغيير معماري كبير، **مؤجّل لجلسة منفصلة**.

### الوضع عند نهاية الجلسة
| المقياس | القيمة |
|---|---|
| Security Score | 97/100 (Medium — موثّق) |
| Desktop Performance | 100/100 |
| Mobile Performance | 79/100 (LCP 4.5s) |
| Accessibility | 89/100 |
| Best Practice | 88-100/100 |
| SEO | 92/100 |

### مؤجّل لجلسة قادمة
- تحسين Mobile LCP عبر SSR/Prerendering.
- إمكانية تحويل `--fab-shift`/`--griffin-float` لخطوات CSS ثابتة (لو حبينا نوصل لـ 100/100 أمان — مش موصى بيه حاليًا).

---

## 2026-09-16 — توحيد نظام الأرشيف (Archivio)

### المطلوب
إضافة تبويب "Archivio" لصفحة Spese، ومراجعة باقي الأقسام، وتوحيد عتبة الأرشفة.

### التنفيذ
1. **src/App.jsx** (`ExpensesBoard`):
   - إضافة حالة `"archive"` في `isInPeriod` — تُرجع `true` للمصاريف الأقدم من 24 ساعة.
   - إضافة زرار "Archivio" في شريط الفترة (Oggi/Settimana/Mese/Archivio).
   - كروت الأقسام (Riparazione/Viaggio/Altre/Carburante) اشتغلت تلقائي مع الفلتر الجديد (بنيت على متغير `filtered` عام).

2. **مراجعة شاملة للأقسام:**
   - Prenotazioni (`PrenotazioniTable.jsx`): كان عنده أرشيف بالفعل (مبني على حالة الحجز Completato/Annullato — مش بالوقت، وده مقصود).
   - GeofencesPanel.jsx: كان عنده أرشيف (زون + تنبيهات) لكن بعتبة أسبوع.
   - GpsTripsPanel.jsx: كان عنده أرشيف بعتبة 24 ساعة بالفعل.

3. **توحيد العتبة على 24 ساعة:**
   - src/App.jsx: تغيير عتبة أرشيف Spese من "أول الشهر" إلى "24 ساعة".
   - src/GeofencesPanel.jsx: تغيير `isOldFence` من أسبوع (`WEEK_MS`) إلى 24 ساعة (`DAY_MS`)، وحذف `WEEK_MS` غير المستخدم.
   - src/GpsTripsPanel.jsx: بلا تغيير (كان أصلاً 24 ساعة).
   - Prenotazioni: بلا تغيير (باقي على أساس الحالة، مش الوقت — قرار صريح من أميديو).

### Git
- Commit 1: `feat(spese): aggiungi tab Archivio per spese antecedenti al mese corrente`
- Commit 2: `91d63f1` — `refactor(archivio): unifica soglia archivio a 24 ore (Spese, Geofences)`
- Push: تم بنجاح على `main` (`4b47535..91d63f1`)

### الحالة النهائية
✅ كل الأقسام (Spese, Prenotazioni, Geofences, GpsTrips) عندها أرشيف الآن، متسق العتبة (24 ساعة) ما عدا Prenotazioni (بالحالة).
✅ مُختبر ومؤكد شغال من أميديو بعد الـ deploy.

---
