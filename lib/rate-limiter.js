/**
 * Rate limiting configuration and utilities
 */

const RATE_LIMIT = {
  WINDOW_MS: 60 * 60 * 1000, // 1 hour window
  MAX_REQUESTS: 100, // 100 requests per window for unauthenticated
  MAX_REQUESTS_AUTH: 200 // 200 requests per window for authenticated
};

// In-memory rate limit tracking
const rateLimitStore = new Map();

/**
 * Get rate limit headers based on client IP
 */
function getRateLimitHeaders(c, isAuthenticated = false) {
  const clientIp = c.req.header('x-forwarded-for') || c.req.header('cf-connecting-ip') || 'unknown';
  const key = `${clientIp}:${Math.floor(Date.now() / RATE_LIMIT.WINDOW_MS)}`;
  const maxRequests = isAuthenticated ? RATE_LIMIT.MAX_REQUESTS_AUTH : RATE_LIMIT.MAX_REQUESTS;
  
  let record = rateLimitStore.get(key);
  const now = Date.now();
  
  if (!record || now > record.resetTime) {
    record = { 
      count: 0, 
      resetTime: Math.floor(now / RATE_LIMIT.WINDOW_MS) * RATE_LIMIT.WINDOW_MS + RATE_LIMIT.WINDOW_MS 
    };
  }
  
  record.count++;
  rateLimitStore.set(key, record);
  
  // Cleanup old entries periodically
  if (rateLimitStore.size > 10000) {
    const cutoff = now - RATE_LIMIT.WINDOW_MS * 2;
    for (const [k, v] of rateLimitStore.entries()) {
      if (v.resetTime < cutoff) rateLimitStore.delete(k);
    }
  }
  
  const remaining = Math.max(0, maxRequests - record.count);
  const resetTime = Math.ceil(record.resetTime / 1000);
  
  return {
    'X-RateLimit-Limit': String(maxRequests),
    'X-RateLimit-Remaining': String(remaining),
    'X-RateLimit-Reset': String(resetTime)
  };
}

/**
 * Clear rate limit store (useful for testing)
 */
function clearRateLimitStore() {
  rateLimitStore.clear();
}

module.exports = {
  RATE_LIMIT,
  getRateLimitHeaders,
  clearRateLimitStore
};
