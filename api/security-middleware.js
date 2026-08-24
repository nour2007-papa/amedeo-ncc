// security-middleware.js - Middleware للأمان على API endpoints
// يوفر: Rate Limiting, Request Size Limits, Security Headers

const MAX_REQUEST_SIZE = 1 * 1024 * 1024; // 1MB limit
const RATE_LIMIT_MAX_REQUESTS = 100; // max requests per window
const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000; // 15 minutes window

// In-memory rate limiting store (for production, use Redis)
const rateLimitStore = new Map();

/**
 * Rate limiting middleware
 */
export function rateLimit(req, res, next) {
  const clientIp = req.headers['x-forwarded-for'] || req.headers['x-real-ip'] || 'unknown';
  const now = Date.now();
  
  // Clean old entries
  for (const [key, data] of rateLimitStore.entries()) {
    if (now - data.timestamp > RATE_LIMIT_WINDOW_MS) {
      rateLimitStore.delete(key);
    }
  }
  
  // Get or create client data
  let clientData = rateLimitStore.get(clientIp);
  if (!clientData) {
    clientData = { count: 0, timestamp: now };
    rateLimitStore.set(clientIp, clientData);
  }
  
  // Check rate limit
  if (clientData.count >= RATE_LIMIT_MAX_REQUESTS) {
    const resetTime = new Date(clientData.timestamp + RATE_LIMIT_WINDOW_MS);
    res.setHeader('X-RateLimit-Limit', RATE_LIMIT_MAX_REQUESTS);
    res.setHeader('X-RateLimit-Remaining', 0);
    res.setHeader('X-RateLimit-Reset', resetTime.toISOString());
    res.status(429).json({ 
      error: 'rate_limit_exceeded',
      message: 'Too many requests. Please try again later.',
      retryAfter: Math.ceil((resetTime.getTime() - now) / 1000)
    });
    return false;
  }
  
  // Increment counter
  clientData.count++;
  rateLimitStore.set(clientIp, clientData);
  
  // Set headers
  res.setHeader('X-RateLimit-Limit', RATE_LIMIT_MAX_REQUESTS);
  res.setHeader('X-RateLimit-Remaining', RATE_LIMIT_MAX_REQUESTS - clientData.count);
  res.setHeader('X-RateLimit-Reset', new Date(clientData.timestamp + RATE_LIMIT_WINDOW_MS).toISOString());
  
  return true;
}

/**
 * Request size limit middleware
 */
export function limitRequestSize(req, res, next) {
  const contentLength = req.headers['content-length'];
  
  if (contentLength && parseInt(contentLength) > MAX_REQUEST_SIZE) {
    res.status(413).json({ 
      error: 'payload_too_large',
      message: `Request body too large. Maximum size is ${MAX_REQUEST_SIZE / 1024 / 1024}MB.`
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
 */
export function applySecurityMiddleware(req, res, next) {
  // Add security headers first
  if (!addSecurityHeaders(req, res, next)) {
    return false;
  }
  
  // Check rate limit
  if (!rateLimit(req, res, next)) {
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
