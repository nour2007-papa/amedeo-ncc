// security-middleware.js - Middleware للأمان على API endpoints
// يوفر: Rate Limiting (Redis أو in-memory), Request Size Limits, Security Headers
//
// ملاحظة عن Rate Limiting:
// السيرفرات على Vercel هي serverless functions — كل "cold start" بيبدأ بذاكرة
// فاضية، يعني الـ Map القديم (in-memory) ممكن يترجع لصفر بدون سابق إنذار ولا
// يحمي فعليًا لو فيه أكتر من instance شغالة في نفس الوقت (لأن كل instance
// بتاعها Map منفصل). الحل هنا: لو اتظبطت متغيرات Upstash Redis (REST API)،
// العدّاد بيتخزن مركزيًا ويشتغل صح مهما كان عدد الـ instances. لو مش متظبطة،
// بيرجع تلقائيًا لنفس سلوك الـ in-memory القديم (أفضل من لا شيء، وميكسرش
// حاجة لمين لسه ملزّمش Redis).

const MAX_REQUEST_SIZE = 1 * 1024 * 1024; // 1MB limit
const RATE_LIMIT_MAX_REQUESTS = 100; // max requests per window
const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000; // 15 minutes window
const RATE_LIMIT_WINDOW_SECONDS = Math.floor(RATE_LIMIT_WINDOW_MS / 1000);

const UPSTASH_URL = process.env.UPSTASH_REDIS_REST_URL;
const UPSTASH_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;
const REDIS_ENABLED = Boolean(UPSTASH_URL && UPSTASH_TOKEN);

if (!REDIS_ENABLED) {
  console.warn(
    '[security-middleware] UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN غير مضبوطة — '
    + 'استخدام rate limiting في الذاكرة المحلية فقط (غير موثوق بين cold starts).'
  );
}

// Fallback in-memory store (يُستخدم فقط لو Redis مش متاح)
const rateLimitStore = new Map();

/**
 * تنفيذ أمر واحد على Upstash عبر REST API (بدون أي مكتبة خارجية).
 * راجع: https://upstash.com/docs/redis/features/restapi
 */
async function upstashCommand(command) {
  const res = await fetch(UPSTASH_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${UPSTASH_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(command),
  });
  if (!res.ok) {
    throw new Error(`Upstash error: ${res.status}`);
  }
  const data = await res.json();
  return data.result;
}

/**
 * زيادة العدّاد الخاص بـ IP معيّن باستخدام Redis (INCR + EXPIRE أول مرة فقط).
 * يرجّع { count, isNew }.
 */
async function incrementRedisCounter(key) {
  const count = await upstashCommand(['INCR', key]);
  if (count === 1) {
    // أول طلب لهذا الـ IP في النافذة الحالية: نضبط انتهاء الصلاحية
    await upstashCommand(['EXPIRE', key, String(RATE_LIMIT_WINDOW_SECONDS)]);
  }
  return count;
}

/**
 * نسخة in-memory احتياطية (نفس المنطق القديم بالضبط).
 */
function incrementMemoryCounter(clientIp) {
  const now = Date.now();

  // تنظيف الإدخالات القديمة
  for (const [key, data] of rateLimitStore.entries()) {
    if (now - data.timestamp > RATE_LIMIT_WINDOW_MS) {
      rateLimitStore.delete(key);
    }
  }

  let clientData = rateLimitStore.get(clientIp);
  if (!clientData) {
    clientData = { count: 0, timestamp: now };
    rateLimitStore.set(clientIp, clientData);
  }

  clientData.count++;
  rateLimitStore.set(clientIp, clientData);

  return {
    count: clientData.count,
    resetTime: new Date(clientData.timestamp + RATE_LIMIT_WINDOW_MS),
  };
}

/**
 * Rate limiting middleware — يدعم Redis (Upstash) مع fallback للذاكرة المحلية.
 */
export async function rateLimit(req, res, next) {
  const clientIp = req.headers['x-forwarded-for'] || req.headers['x-real-ip'] || 'unknown';

  let count;
  let resetTime;

  if (REDIS_ENABLED) {
    try {
      const key = `ratelimit:${clientIp}`;
      count = await incrementRedisCounter(key);
      // بنقرا الـ TTL الفعلي من Redis عشان الـ header يكون دقيق حتى لو
      // الطلب مش أول واحد في النافذة.
      const ttl = await upstashCommand(['TTL', key]);
      const ttlSeconds = ttl > 0 ? ttl : RATE_LIMIT_WINDOW_SECONDS;
      resetTime = new Date(Date.now() + ttlSeconds * 1000);
    } catch (error) {
      // لو Redis فشل لأي سبب (شبكة، حد الاستخدام...)، منمنعش الموقع من
      // الشغل — بنرجع للـ in-memory بدل ما نكسر كل الـ API.
      console.error('[security-middleware] فشل Redis rate limit، الرجوع للذاكرة المحلية:', error.message);
      const memResult = incrementMemoryCounter(clientIp);
      count = memResult.count;
      resetTime = memResult.resetTime;
    }
  } else {
    const memResult = incrementMemoryCounter(clientIp);
    count = memResult.count;
    resetTime = memResult.resetTime;
  }

  res.setHeader('X-RateLimit-Limit', RATE_LIMIT_MAX_REQUESTS);
  res.setHeader('X-RateLimit-Remaining', Math.max(0, RATE_LIMIT_MAX_REQUESTS - count));
  res.setHeader('X-RateLimit-Reset', resetTime.toISOString());

  if (count > RATE_LIMIT_MAX_REQUESTS) {
    res.status(429).json({
      error: 'rate_limit_exceeded',
      message: 'Too many requests. Please try again later.',
      retryAfter: Math.max(0, Math.ceil((resetTime.getTime() - Date.now()) / 1000)),
    });
    return false;
  }

  return true;
}

/**
 * Request size limit middleware
 */
export function limitRequestSize(req, res, next) {
  const contentLength = req.headers['content-length'];

  if (contentLength && parseInt(contentLength, 10) > MAX_REQUEST_SIZE) {
    res.status(413).json({
      error: 'payload_too_large',
      message: `Request body too large. Maximum size is ${MAX_REQUEST_SIZE / 1024 / 1024}MB.`,
    });
    return false;
  }

  return true;
}

/**
 * Security headers middleware
 */
export function addSecurityHeaders(req, res, next) {
  // Prevent XSS
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');

  // Prevent content sniffing
  res.setHeader('X-Content-Type-Options', 'nosniff');

  // HSTS (only in production with HTTPS)
  if (process.env.NODE_ENV === 'production') {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }

  // Referrer policy
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

  // Content Security Policy (basic)
  res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; connect-src 'self' https:;");

  return true;
}

/**
 * Input sanitization middleware
 */
export function sanitizeInput(req, res, next) {
  if (req.body) {
    try {
      // Remove potentially dangerous fields
      const dangerousFields = ['__proto__', 'constructor', 'prototype'];
      const cleanBody = JSON.parse(JSON.stringify(req.body));

      function removeDangerous(obj) {
        if (typeof obj !== 'object' || obj === null) return obj;

        for (const key of Object.keys(obj)) {
          if (dangerousFields.includes(key)) {
            delete obj[key];
          } else if (typeof obj[key] === 'object') {
            removeDangerous(obj[key]);
          }
        }
        return obj;
      }

      removeDangerous(cleanBody);
      req.body = cleanBody;
    } catch (error) {
      console.error('[security-middleware] Sanitization error:', error);
      res.status(400).json({ error: 'invalid_payload' });
      return false;
    }
  }

  return true;
}

/**
 * Apply all security middleware
 * ملحوظة: بقت async لأن rateLimit بقى async (Redis يحتاج await).
 * الاستدعاء بتاعها لازم يبقى: `if (!(await applySecurityMiddleware(req, res))) return;`
 */
export async function applySecurityMiddleware(req, res, next) {
  // Add security headers first
  if (!addSecurityHeaders(req, res, next)) {
    return false;
  }

  // Check rate limit
  if (!(await rateLimit(req, res, next))) {
    return false;
  }

  // Check request size
  if (!limitRequestSize(req, res, next)) {
    return false;
  }

  // Sanitize input
  if (!sanitizeInput(req, res, next)) {
    return false;
  }

  return true;
}
