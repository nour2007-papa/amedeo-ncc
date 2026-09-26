import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  // قللنا العدد إلى 5 لتجنب الحظر الفوري (429) حتى نتأكد من نجاح الطلب أولاً
  vus: 5, 
  duration: '10s',
};

export default function () {
  const url = 'https://amedeo-ncc.vercel.app/api/sync-pending';

  // 1. إضافة الترويسات (Headers) اللازمة لتخطي الـ security-middleware
  const params = {
    headers: {
      'Content-Type': 'application/json',
      // إذا كان مسارك محمي، يجب فك التعليق عن السطر التالي وإضافة التوكن الصحيح
      // 'Authorization': 'Bearer YOUR_SECRET_TOKEN_HERE', 
      // 'x-api-key': 'YOUR_API_KEY_HERE',
    },
  };

  // 2. إرسال بيانات (Payload) إذا كان الـ API يطلب ذلك
  const payload = JSON.stringify({
    source: "load-test",
    timestamp: new Date().toISOString()
  });

  // 3. تغيير نوع الطلب من GET إلى POST
  const res = http.post(url, payload, params);
  
  console.log(`Status: ${res.status} | Body: ${res.body.substring(0, 50)}`);

  // التحقق من نجاح الطلب
  check(res, {
    'is status 200': (r) => r.status === 200,
    'is status 201': (r) => r.status === 201,
  });

  sleep(1);
}