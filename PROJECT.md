

\# Grifone NCC (amedeo-ncc) — الصورة الكاملة للمشروع



> مستند موحّد يجمع محتوى: `CLAUDE.md` + `PROJECT.md` + `README.md` + `AUDIT\_REPORT.md`

> آخر تحديث معروف: 05/09/2026



\---



\## 1. نظرة عامة



\*\*Grifone NCC\*\* (الاسم السابق: Amedeo NCC) هو موقع تسويقي عام + نظام حجز لخدمة سيارات بسائق (NCC) في ميلانو.



\- \*\*الستاك:\*\* Vue 3 (Composition API, `<script setup>`) + Vite + Firebase + نشر على Vercel

\- \*\*اللغات:\*\* IT / EN / AR (عربي RTL)

\- \*\*Repo:\*\* `github.com/nour2007-papa/amedeo-ncc.git`

\- \*\*المسار المحلي:\*\* `C:/Users/amede/OneDrive/Desktop/amedeo-ncc-vue-git/vue-project-v2`

\- \*\*جزء من نظام مكوّن من مشروعين:\*\* هذا المشروع (الموقع العام + الحجز) + \*\*`ncc-fleet`\*\* (تطبيق منفصل على `amedeo-fleet.vercel.app` يستخدمه المشغّل لتوزيع السائقين). أغلب التعقيد غير الواضح هنا هو \*\*جسر المزامنة\*\* بين الاثنين.



\---



\## 2. الأوامر الأساسية



```bash

npm install

npm run dev        # سيرفر Vite على http://localhost:5173

npm run build      # → dist/

npm run preview    # تشغيل نسخة dist/ المبنية



\# مرة واحدة فقط: زرع مستند إعدادات Firestore (config/settings) اللي منه firestore.rules بتقرأ adminEmail

SITE\_SERVICE\_ACCOUNT\_KEY=<base64 service account> ADMIN\_EMAIL=... node scripts/init-firestore-config.js



\# تجهيز المشروع للمشاركة (بيشيل .env/.git/node\_modules/dist)

bash safe-export.sh /path/to/vue-project-v2

```



⚠️ \*\*لا يوجد test runner ولا linter ولا formatter.\*\* التحقق من التعديلات يكون بتشغيل `npm run dev` فعليًا.

`/api/\*` هي Vercel Serverless Functions — \*\*لا تعمل\*\* مع `npm run dev` محليًا (هترجع 404)؛ لازم `vercel dev` أو اختبارها على preview منشور فعليًا.

`SYNC\_TESTING\_CHECKLIST.md` = checklist يدوي لاختبار نظام المزامنة.



\---



\## 3. البنية (Architecture)



| الملف/المجلد | الدور |

|---|---|

| `src/App.vue` | الموقع العام — single-page بأقسام anchor (hero, servizi, flotta, video, viaggi, contatti) |

| `src/AeroportoPage.vue` | صفحات مستقلة `/aeroporti/malpensa`, `/linate`, `/bergamo` (mount منفصل في `main.js`) |

| `src/BookingForm.vue` | فورم الحجز (له `UI` object داخلي خاص، مش من `i18n.js`) |

| `src/Admin.vue` | لوحة تحكم المشغّل |

| `src/Modifica.vue` | صفحة تعديل/إلغاء ذاتية للعميل (له `UI` object داخلي خاص) |

| `src/content.js` | بيانات الخدمات/الأسطول/الرحلات (الصور لسه Unsplash placeholders) |

| `src/i18n.js` | قاموس الترجمة `dict` بـ `it`/`en`/`ar` |

| `api/` | Serverless Functions: `booking-edit.js`, `sync-pending.js`, `sync-webhook.js`, `\_validation.js`, `\_rateLimit.js` / `security-middleware.js` |

| `src/sync-orchestrator.js` + `src/sync-utils.js` + `src/performance-optimizer.js` | نظام المزامنة (تفاصيل في القسم 5) |



\### التوجيه (Routing): 3 تطبيقات في bundle واحد، عبر hash الرابط

`src/main.js` يفحص `window.location.hash` ويعمل import ديناميكي لمكوّن جذر واحد فقط، عشان الزائر العادي متنزّلش كود الأدمن:



\- \*\*افتراضي\*\* → `App.vue` (الموقع العام)

\- \*\*`#gestione-9f3k2x7q`\*\* → `Admin.vue` — "الرابط السري" هو التحكم الوحيد على مستوى التوجيه؛ التصريح الحقيقي هو Firebase Auth + `firestore.rules`. عند تفعيل هذا المسار، `main.js` بيحقن كمان `/admin.css`، `manifest-gestione.json`، meta tags خاصة بـ iOS، ويسجّل `sw-gestione.js`. الـ \*\*PWA موجودة فقط لهذا المسار\*\* — الموقع العام عمدًا من غير manifest ولا service worker.

\- \*\*`#modifica-{bookingId}-{editToken}`\*\* → `Modifica.vue` (تعديل/إلغاء ذاتي للعميل)



⚠️ ستايل `Admin.vue` بييجي من `public/admin.css` الثابت، مش من `<style>` block — عشان ترتيب chunks في Vite ممكن يسرّب CSS بتاع الموقع العام جوه لوحة التحكم. \*\*لازم يفضل كده.\*\*



\### مشروعين Firebase منفصلين — أهم نقطة قبل ما تلمس Admin.vue أو كود المزامنة



| | مشروع الموقع (`amedeo-ncc`) | مشروع الأسطول (`amedeo-fleet`) |

|---|---|---|

| Client SDK | `src/firebase.js` → `db`, `auth` | `src/firebase-fleet.js` → `fleetDb`, `fleetAuth` (app اسمها `'fleet'`) |

| Env prefix | `VITE\_FIREBASE\_\*` | `VITE\_FLEET\_FIREBASE\_\*` |

| Collections | `bookings`, `config/settings` | `prenotazioni`, `trips`, `employees` |

| Admin SDK key (Vercel) | `SITE\_SERVICE\_ACCOUNT\_KEY` (base64 JSON) | `FLEET\_SERVICE\_ACCOUNT\_KEY` (base64 JSON) |



\- المشروعان منفصلان فعليًا، فمطلوب \*\*جلستَي Auth منفصلتين\*\*. `login()` في `Admin.vue` بيسجّل دخول في الاتنين بنفس بيانات الأدمن.

\- أي كتابة على `fleetDb` من المتصفح من غير جلسة `fleetAuth` حية بترجع `permission-denied` — عشان كده `SyncOrchestrator.performSync()` بينادي `waitForFleetAuth()` أولاً بدل ما يقرا `fleetAuth.currentUser` مباشرة.

\- الـ env vars في `.env`/`.env.local` (متجاهلة في git)؛ `.env.example` هو القالب. مفيش مفاتيح hardcoded — الموديولين بتوع firebase بيعملوا `console.warn` ويكملوا (بدون throw) لو المتغيرات ناقصة.



\---



\## 4. دورة حياة الحجز (Booking Lifecycle)



1\. \*\*الزائر يبعت الفورم\*\* (`BookingForm.vue`) → `addDoc` في `bookings` بتاعة الموقع، بـ `confirmed: false`، و`createdAt` من `serverTimestamp()`، و`editToken` عشوائي (32 hex). بيتكتب فيها كل من الأسماء "القديمة" (`serviceDate`, `flight`, `people`, `bags`, `hotel`) وأسماء سكيمة الأسطول (`dataOra`, `volo`, `passeggeri`, `bagagli`, `destinazione`, `zona`, `tipoServizio`, `lingua`) — عشان الـ mirror بتاع الأسطول ميحتاجش أي mapping. بعدين تحويل للمتصفح لـ `wa.me/...` برسالة جاهزة.

2\. \*\*Draft mirror\*\*: الفورم بيبعت (fire-and-forget) `POST /api/sync-pending` بـ `{ bookingId }` بس. الـ endpoint بيقرا الدوكيومنت الحقيقي تاني من `siteDb` بالـ Admin SDK ويبني سجل الأسطول من الحقول المتحقق منها فقط — \*\*مش واثق في الـ body المُرسَل\*\*. كمان بيرفض الحجوزات الأقدم من 30 دقيقة والـ IDs اللي مش مطابقة لـ `/^\[A-Za-z0-9]{10,40}$/`. الفشل غير حاجز (non-blocking) — العملية بتفضل في queue في `localStorage` (`SyncQueueManager`).

3\. \*\*الأدمن يأكّد\*\* في `Admin.vue`، ممكن يعيّن سائق من `employees` بتاعة الأسطول. ده بيضبط `confirmed`، وبيعمل create/update لدوكيومنت `prenotazioni` في الأسطول (وبيخزّن `fleetDocId` رجوع في الحجز) ودوكيومنت `trips` (`fleetTripId`)، وبعدين يفتح واتساب برسالة تأكيد للعميل. \*\*رسالة السائق مبتفتحش أوتوماتيك\*\* — المتصفحات بتمنع `window.open()` تانية في نفس الـ click handler — فبتتحط جاهزة في `pendingDriverWaLink` وراء زرار مستقل.

4\. \*\*العميل يعدّل\*\* عبر رابط `#modifica-`، اللي بيمر على `POST/GET /api/booking-edit`. Firestore rules بتمنع أي قراءة/كتابة مباشرة من الكلاينت على `bookings`، فكل حاجة بتتنفذ server-side بالـ Admin SDK: مقارنة `editToken` بـ constant-time، نافذة تعديل 6 ساعات قبل الميعاد، allowlist لحقول قابلة للتعديل بحد أقصى للطول لكل حقل، و`publicView()` projection ما بترجعش `editToken`/`fleetDocId` أبدًا.

5\. \*\*من الأسطول للموقع\*\*: `listenForFleetCompletions()` في `Admin.vue` بتراقب `prenotazioni` في الأسطول لما `stato == 'completato'` وبتعمل mirror للإكمال، وبتحط `completionSynced = true` عشان متتكررش المعالجة.



\*\*فروق الحالات بين النظامين\*\* — مُترجَمة عبر جدول واحد `STATUS\_MAPPER` في `src/sync-orchestrator.js`:

`pending`↔`nuovo\_contatto`، `confirmed`↔`confermato`، `confirmed\_with\_driver`↔`autista\_assegnato`، `cancelled`↔`annullato`



\---



\## 5. نظام المزامنة (Sync System)



\*\*الملفات:\*\* `src/sync-orchestrator.js` (classes) + `src/sync-utils.js` (setup/queue/monitor/listener wrappers) + `src/performance-optimizer.js` (`CacheManager`, `QueryOptimizer`, `BatchProcessor`, `MemoryMonitor`, `PerformanceMetrics`, `debounce`/`throttle`). `Admin.vue` بتربطهم في `initializeEnhancedSync()`. التوثيق الكامل في `SYNC\_SYSTEM\_DOCUMENTATION.md`.



\### حماية من الـ loop اللانهائي (سهل كسرها بالغلط)

\- `determineSyncAction()` بترجع `skip` لو `syncedAt >= updatedAt`. من غيرها، كل sync ناجح بيكتب `bookings.syncedAt`، وده نفسه event `modified` على الـ collection اللي بيراقبها الـ realtime listener → \*\*loop لا نهائي\*\*.

\- `lastFailedAttemptAt`/`failureCooldownMs` (60 ثانية) \*\*in-memory بس عمدًا\*\*. حفظها في Firestore هتولد event `modified` تاني وتغذي نفس الـ loop.



\### إعادة المحاولة والدوائر

\- `withExponentialBackoff` (5 محاولات، من 1 ثانية لحد سقف 30 ثانية)

\- `SyncErrorHandler` فيه circuit breaker بيشتغل بس على أكواد transient (`unavailable`, `deadline-exceeded`, `resource-exhausted`)

\- `setupRealtimeSyncListener` بيعمل debounce للـ bursts (1 ثانية) وبيعمل batch عبر `syncBatch` (5 في المرة)

\- `initializeEnhancedSync()` \*\*لازم تفضل idempotent\*\* — قبل كده كانت بتسجّل `onSnapshot` مكرر في كل مرة بتتنادى



\### `/api/sync-webhook`

النظير server-side للأحداث المدفوعة من Cloud Functions. بيتطلب توقيع `x-webhook-signature` (HMAC-SHA256) على الـ raw body باستخدام `SYNC\_WEBHOOK\_SECRET`؛ لو المتغير ده مش موجود بيرفض \*\*كل حاجة\*\* بدل ما يرجع لسر افتراضي. الأحداث الفاشلة بتروح dead-letter queue في Firestore.



\### الحالة والحدود المعروفة (من جلسات سابقة)

\- تم إصلاح `waitForFleetAuth()` لمشكلة race condition بتاعة `permission-denied` (commit `d3d9a46`)

\- تم إصلاح `autistaUid` الناقص في الـ mirror (Admin.vue دلوقتي بيجيب `authUid` من `employees`)

\- \*\*الحد المعروف حاليًا:\*\* المزامنة في اتجاه واحد بس (site → fleet) — \*\*لا يوجد بعد sync عكسي\*\* لما السائق يقفل رحلة من ناحية `ncc-fleet`

\- \*\*لسه مش متعمول:\*\* sync عكسي `ncc-fleet` → `amedeo-ncc` لحالة "مكتملة"، وربط رابط `#modifica-` جوه رسالة تأكيد الواتساب (`WA\_CONFIRM\_TEXT`) — دلوقتي العميل مالوش وسيلة يوصل لصفحة التعديل



\---



\## 6. الأمان (Security)



هذا القسم مبني على 3 مراجعات: `SECURITY\_AUDIT\_2026-08-31.md`, `SYNC\_SECURITY\_PERFORMANCE\_AUDIT.md`, `AUDIT\_REPORT.md` — وبعض النقاط دي كانت \*\*رجعت تاني بعد ما اتصلحت قبل كده\*\*، فمينفعش تتلغى.



\### القواعد الثابتة (Invariants) — من CLAUDE.md

\- `firestore.rules`: الزوار المجهولون عندهم `create` بس على `bookings`، بـ allowlist دقيق للمفاتيح، حدود طول، enum checks على `lingua`/`tipoServizio`، `createdAt == request.time`، و`confirmed == false`. كل حاجة تانية `isAdmin()`. `config/\*` قراءة-فقط للأدمن — الـ `get()` الداخلي في `isAdmin()` بيشتغل بغض النظر عن قاعدة القراءة بتاعة الدوكيومنت نفسه.

\- كل API endpoint لازم يبدأ بـ `if (!(await applySecurityMiddleware(req, res))) return;` — بتكون `async` عشان الـ rate limiting بتستنى Redis.

\- Rate limiting (`api/security-middleware.js`) بيستخدم Upstash Redis REST (`UPSTASH\_REDIS\_REST\_URL`, `UPSTASH\_REDIS\_REST\_TOKEN`) — لأن الـ cold starts بتاعة Vercel serverless بتصفّر أي `Map` في الميموري وكل instance هيعد لوحده. المسار in-memory هو fallback متدهور بس.

\- ما ترجعش أبدًا `error.message` ولا identifiers داخلية للمستخدم — أكواد عامة بس (`sync\_failed`, `invalid\_payload`, `server\_not\_configured`). تفاصيل التشخيص تروح على `error.debugInfo` و`console.error` (كونسول متصفح الأدمن بس)، \*\*مش\*\* في `error.message` اللي ممكن log sinks خارجية تلقطه.

\- CSP متظبطة في مكانين ولازم يفضلوا متوافقين: `vercel.json` للصفحات، و`addSecurityHeaders()` في الـ middleware لردود الـ API (`default-src 'none'` لأن endpoints الـ JSON مش بترندر حاجة).



\### نتائج المراجعات والتحسينات المنفذة (من AUDIT\_REPORT.md، أغسطس 2026)

\- \*\*فصل i18n\*\*: قاموس الترجمة كان جوه `App.vue` (400+ سطر) → اتنقل لـ `src/i18n.js`، وده قلّل حجم `App.vue` من \~1800 سطر لـ \~700 سطر (تقليل \~60%)

\- \*\*فصل المحتوى\*\*: بيانات الخدمات/الأسطول/الرحلات اتنقلت لـ `src/content.js`

\- \*\*`src/validation.js`\*\* جديد: `sanitizeInput()`, `validateEmail()`, `validatePhone()`, `validateDate()`, `validateFlightNumber()`, `validateNumberPeople()` (1-20), `validateNumberBags()` (0-20) — لمنع XSS ومدخلات غير صالحة

\- \*\*Env vars\*\*: `.env.example` كقالب، `firebase.js` بيقرا من `import.meta.env`، `.gitignore` بيمنع رفع `.env`

\- \*\*تحسينات تجاوب\*\*: media queries مخصصة للتابلت (761px–1024px) — شبكة من 5 أعمدة لـ 4، تعديل الخطوط/التباعد

\- \*\*تحسين الصور\*\*: hover effect لإزالة grayscale، معالجة أخطاء تحميل مع logging، transitions

\- \*\*معالجة أخطاء أفضل\*\*: في `saveToFirestore` (`BookingForm.vue`) وفي `login`/`resetPassword`/`deleteBooking` (`Admin.vue`)



\### آخر نتائج فحص (سبتمبر 2026 — من PROJECT.md)

\- Audit كامل نهاية أغسطس 2026: fix تسريب debug info، أخطاء عامة، CSP موحدة (commit `b005b56`)

\- \*\*Barrion scan (27 أغسطس): 85/100\*\* — النقاط المعلقة: Certificate Expiry، CSP score، CSP Bypass (لازم نشيل `apis.google.com` من `script-src`)، Trusted Types، `style-src 'unsafe-inline'` (محتاج إعادة هيكلة مكوّنات Vue)

\- \*\*Snyk scan (2 سبتمبر)\*\*: تم إصلاح CWE-1287 في `sync-webhook.js`؛ 2 false positive بتوع SQL Injection اتأكد إنهم مش حقيقيين واتقفلوا

\- API key بتاعة Firebase مقيّدة على Google Cloud Console (لكل من `amedeo-ncc` و`amedeo-fleet`)

\- تم التأكد من env vars على Vercel Production: `UPSTASH\_REDIS\_REST\_URL/TOKEN`, `SYNC\_WEBHOOK\_SECRET`, `SITE\_SERVICE\_ACCOUNT\_KEY`, `FLEET\_SERVICE\_ACCOUNT\_KEY`



\---



\## 7. SEO (جلسة 5 سبتمبر 2026)



\*\*المشكلة الجذرية:\*\* ما كانش فيه routing حقيقي حسب اللغة — `currentLang` كان مجرد state في JS، ونفس الـ URL لـ IT/EN/AR → `hreflang` بلا فايدة، وmeta tags ثابتة نفسها لكل اللغات.



\*\*الإصلاحات المطبّقة:\*\*

\- Routing قائم على المسار (path-based) بدون Vue Router: `detectLangFromPath()` + `history.pushState` جوه `setLang()` (في `App.vue`)

\- `vercel.json`: rewrites لـ `/en`, `/ar`, `/en|ar/aeroporti/:slug`

\- `hreflang` في `index.html` اتصلحوا بـ URLs حقيقية لكل لغة

\- `title`/`meta description` ديناميكيين حسب اللغة (object اسمه `SEO\_META` في `App.vue`، مع `watch` على `currentLang`)

\- `scripts/prerender.js` جديد (postbuild) — بيستخدم `vite preview` + Puppeteer عشان يولّد snapshots HTML ثابتة لكل لغة/route جوه `dist/`، عشان محركات البحث تشوف المحتوى والـ meta الصح من غير ما تشغّل JS

\- `package.json`: script جديد `postbuild`، وdependency جديدة `puppeteer`



\*\*محتاج تأكيد:\*\* بناء محلي (`npm run build`) + فحص `dist/en/index.html` و`dist/ar/index.html` بـ View Source بعد الـ deploy



\*\*الخطوات الجاية (لسه ما بدأتش):\*\*

\- `sitemap.xml` كامل بكل الروابط/اللغات

\- `robots.txt`

\- Google Search Console + Google Business Profile

\- محتوى SEO محلي إضافي (صفحات مدن/مسارات)



\---



\## 8. القواعد والعادات (Conventions \& Gotchas)



\- \*\*لغة التعليقات مختلطة\*\* — عربي، إيطالي، إنجليزي، أحيانًا في نفس الملف. لازم تتبع أي لغة موجودة حوالين الكود اللي بتعدّله. التعليقات غالبًا بتوثّق \*سبب\* الإصلاح (`BUG FIX:`, `SICUREZZA (fix):`, `⚠️ CAVEAT`) — \*\*حافظ عليها\*\*؛ هي اللي بتوثّق حمايات الـ loop والقرارات الأمنية.

\- كل نصوص الواجهة في `src/i18n.js` (`dict`) بمفاتيح `it`/`en`/`ar`؛ كل لغة لازم تتحدّث مع التانية. العربي بيتحكم في الـ RTL layout. `App.vue` بيقرا منها بس جوه `computed()` عشان القاموس ميتلمسش وقت module-eval. `BookingForm.vue` و`Modifica.vue` عندهم `UI` objects داخلية صغيرة بدل استخدام `dict`.

\- محتوى ثابت (خدمات، عربيات الأسطول، كروت الرحلات، صور دوّارة) هو بيانات في `src/content.js`، متربط بمفتاح i18n. الصور لسه Unsplash placeholders.

\- `vite-version-plugin.js` بيكتب `public/version.json` وقت `buildStart`؛ `useVersionCheck()` بيعمل poll كل 60 ثانية وبيعمل force-reload لو الإصدار اتغيّر. `public/version.json` هو build artifact — طبيعي يبقى "dirty" في git.

\- `vite.config.js` بيحط كل موديولات `firebase`/`@firebase` في chunk واحد اسمه `firebase`.

\- `sw-gestione.js` بيعترض \*\*بس\*\* requests من نوع `mode === 'navigate'`. نسخة قديمة كانت بتعمل cache لكل حاجة وحوّلت أي مشكلة شبكة بسيطة لفشل كامل.

\- ملفات `\*.patch` وملفات `\*\_AUDIT\*.md` / `SYNC\_\*.md` على مستوى الـ root هي working artifacts، مش build inputs.

\- رسائل الـ commit بتتبع بادئات conventional-commit (`fix:`, `feat:`, `security:`, `perf:`, `docs:`, `style:`, `chore:`)، والموضوع ممكن يبقى إنجليزي أو إيطالي أو عربي.



\---



\## 9. مميزات الموقع (من README.md — تاريخ التطوير)



مقارنة بأول نسخة Vue، اتضاف:

\- \*\*9 وجهات كاملة\*\* في قسم الرحلات (روما، بيزا، فينيسيا، كومو، فلورنسا، مدن إيطالية تانية بصورة متغيّرة، باريس، سويسرا، اختار وجهتك) — بدل 4 بس

\- زرار على كل كارت (عربية/رحلة) بيودّي على فورم الحجز ويملاه أوتوماتيك

\- بانر كوكيز + نافذة سياسة خصوصية (GDPR) كاملة

\- SEO كامل في `index.html`: meta description, Open Graph, Twitter Card, schema.org LocalBusiness (JSON-LD) — \*\*لاحظ:\*\* ده كان قبل جلسة الـ SEO في القسم 7 اللي ضافت routing حقيقي حسب اللغة

\- فوتر بـ 3 أعمدة (تنقل / قانوني / تواصل)

\- \*\*قسم التقييمات اتشال بالكامل عمدًا\*\* — كانت تقييمات مُختلَقة (Maria L., Ahmed K., Giuseppe R.) وده مخاطرة قانونية. \*\*لا تُرجَع إلا بتقييمات حقيقية من عملاء فعليين\*\*

\- زرار واتساب عائم (يمين تحت، z-index=9999)، بيدعم RTL (بينتقل لليسار في العربي تلقائيًا)

\- شريط "المطار" (departure board) بيترجم صح مع تبديل اللغة



\*\*ملاحظة تقنية:\*\* بما إن المشروع Vue 3 Composition API (`<script setup>`)، مشكلة الـ TDZ ("Cannot access 'dict' before initialization") اللي كانت في نسخة الـ HTML الخام مش ممكن تحصل هنا — كل حاجة بتتقرا من `dict` جوه `computed()`، يعني بتتقيّم وقت العرض مش وقت تحميل السكريبت.



\---



\## 10. الفجوات المعروفة والمهام المتبقية (Known Gaps)



هذه هي القائمة الموحّدة من كل الملفات الأربعة — \*\*دي أولوية العمل القادم:\*\*



| البند | المصدر | الحالة |

|---|---|---|

| رابط `#modifica-{bookingId}-{editToken}` مش موجود في رسالة تأكيد الواتساب (`WA\_CONFIRM\_TEXT`) | CLAUDE.md | العميل حاليًا مالوش وسيلة يوصل لصفحة التعديل |

| Sync عكسي `ncc-fleet` → `amedeo-ncc` لحالة "مكتملة" | CLAUDE.md + PROJECT.md | لسه مش متعمول |

| P.IVA حقيقي في الفوتر | README.md + PROJECT.md | TODO |

| دومين حقيقي وصور حقيقية بدل Unsplash | README.md + PROJECT.md | TODO |

| قسم التقييمات | README.md + PROJECT.md | في انتظار تقييمات حقيقية |

| `style-src 'unsafe-inline'` في CSP | PROJECT.md | يحتاج إعادة هيكلة مكوّنات Vue |

| إزالة `apis.google.com` من `script-src` | PROJECT.md | من نتائج Barrion scan |

| `sitemap.xml` كامل + `robots.txt` | PROJECT.md | لسه ما بدأش |

| Google Search Console + Business Profile | PROJECT.md | لسه ما بدأش |



\### توصيات إضافية من AUDIT\_REPORT.md (لسه مش منفذة)

\- PWA كامل بـ service worker يعمل offline (للموقع العام، مش بس لوحة الأدمن)

\- structured data محسّن إضافي لـ SEO

\- اختبارات وحدة (Jest/Vitest) — \*\*حاليًا لا يوجد أي test runner في المشروع\*\*

\- Lighthouse CI لمراقبة الأداء

\- WebP + lazy loading متقدم للصور

\- Rate limiting إضافي على فورم الحجز تحديدًا

\- Google Analytics

\- تحسين ARIA labels لقارئ الشاشة

\- Real-time validation في الفورمات

\- Error boundaries للمكوّنات



\---



\## المصادر الأصلية لهذا المستند

1\. `CLAUDE.md` — دليل تقني للعمل على الكود (بنية، أوامر، دورة حياة الحجز، أمان، عادات)

2\. `PROJECT.md` — سجل جلسات وحالة حالية (SEO، أمان، sync) بتاريخ 05/09/2026

3\. `README.md` — دليل تشغيل + سجل تاريخي لتطوير النسخة Vue بالمقارنة بنسخة HTML سابقة

4\. `AUDIT\_REPORT.md` — تقرير مراجعة فنية شاملة بتاريخ 22 أغسطس 2026 (تحسينات كود، أمان، أداء، توصيات مستقبلية)



