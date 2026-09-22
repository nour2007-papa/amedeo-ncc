# سجل أمان — ncc-fleet — 22 سبتمبر 2026

## الموضوع: مراجعة وإصلاح Firestore Security Rules (S-01)

### الثغرات المكتشفة (من مراجعة 14 سبتمبر 2026)
1. **`cars/{docId}`**: `allow update` كان بيستخدم `hasAny` بدون التحقق من ملكية السائق → أي مستخدم `signedIn()` يقدر يعدّل `driverUid`/`stato` لأي عربية مش بتاعته.
2. **`liveLocations/{carId}`**: دالة `isOwnLiveLocationWrite()` كانت بتسمح بتجاوز التحقق لو `driverUid`/`carId` مش موجودين في الـ payload → إمكانية تزوير موقع GPS لأي عربية.

### الفيكس المطبّق
- `cars`: تحويل الشرط لـ `hasOnly` + إضافة شرط `resource.data.driverUid == request.auth.uid || resource.data.currentDriverUid == request.auth.uid`، وحذف `driverUid`/`currentDriverUid` من الحقول المسموح للسائق يعدّلها (تخصيص العربية بقى Admin-only بالكامل).
- `liveLocations`: `driverUid` و `carId` بقوا إجباريين في كل `create`/`update` (مش اختياريين زي الأول).

### التحقق قبل الديبلوي
- تأكيد من Amedeo: كل عربية مربوطة بـ `driverUid` ثابت، والسائق مش بيقدر يغيّره بنفسه — التخصيص Admin-only أصلاً.
- مراجعة كود `firebase.js` (Portale Autista): مفيش أي `setDoc`/`updateDoc` مباشر على collection `cars` من الفرونت إند بتاع السائق. دالة `sendLiveLocation()` دايمًا بتبعت `carId` و `driverUid` في كل نداء (سطر 284-315) → الفيكس متوافق 100% مع السلوك الحالي.
- **النتيجة**: الفيكس آمن للديبلوي، صفر خطر كسر وظيفي.

### أوامر Git
```bash
git add firestore.rules
git commit -m "fix(rules): close cars/liveLocations write vulnerabilities (hasOnly + ownership check, mandatory driverUid/carId)"
git push
firebase deploy --only firestore:rules --project amedeo-fleet
```

### اختبار بعد الديبلوي (حساب سائق حقيقي، مثال Ahmed)
- [ ] "Inizia lavoro" يشتغل عادي
- [ ] GPS location يستمر يتبعت ("GPS: inviato ✓")
- [ ] محاولة تعديل `cars/{عربية مش بتاعته}` بالـ Emulator/Console → لازم PERMISSION_DENIED

### الحالة
🟡 الفيكس جاهز ومراجَع بالكامل — بانتظار تنفيذ `firebase deploy` من Amedeo.

---

## البنود المفتوحة التانية في خطة الـ Security Review
- [ ] Admin panel: MFA غايب، الإيميل والـ route السري ظاهرين في bundle الـ dist العام
- [ ] تكرار مستندات الحجوزات: `Admin.vue` بيعمل create/update لـ `fleetDocId` من غير transaction (عكس `sync-pending.js`)
- [ ] `bookings creation` مفتوح من غير Firebase App Check
- [ ] `api/booking-edit.js` لسه شغال server-side رغم تعطيل الوظيفة من الـ UI
- [ ] `sync-webhook.js` من غير حماية replay/timestamp
- [ ] مفيش PITR/backup موثّق + hard-delete في `Admin.vue`
- [ ] `validateFlightNumber` بترفض أكواد IATA حرف+رقم (easyJet U2, Wizz W6)
- [ ] canonical/sitemap/hreflang بتشاور على `www.amedeo-ncc.vercel.app` بينما باقي الكود بيستخدم الدومين من غير www
