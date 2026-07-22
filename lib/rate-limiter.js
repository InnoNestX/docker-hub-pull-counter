/**
 * Rate limiting with Redis when available, in-memory fallback otherwise.
 * Enforces limits and returns headers for clients.
 */

const RATE_LIMIT = {
  WINDOW_MS: 60 * 60 * 1000,
  MAX_REQUESTS: 100,
  MAX_REQUESTS_AUTH: 200
};

const rateLimitStore = new Map();

function getClientIp(c) {
  const forwarded = c.req.header('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0].trim();
  return c.req.header('cf-connecting-ip') || c.req.header('x-real-ip') || 'unknown';
}

function getWindowBucket(now = Date.now()) {
  return Math.floor(now / RATE_LIMIT.WINDOW_MS);
}

function getResetTime(bucket) {
  return (bucket + 1) * RATE_LIMIT.WINDOW_MS;
}

function memoryConsume(ip, maxRequests) {
  const now = Date.now();
  const bucket = getWindowBucket(now);
  const key = `${ip}:${bucket}`;
  let record = rateLimitStore.get(key);

  if (!record || now > record.resetTime) {
    record = { count: 0, resetTime: getResetTime(bucket) };
  }

  record.count += 1;
  rateLimitStore.set(key, record);

  if (rateLimitStore.size > 10000) {
    const cutoff = now - RATE_LIMIT.WINDOW_MS * 2;
    for (const [storeKey, value] of rateLimitStore.entries()) {
      if (value.resetTime < cutoff) rateLimitStore.delete(storeKey);
    }
  }

  return {
    count: record.count,
    remaining: Math.max(0, maxRequests - record.count),
    resetTime: Math.ceil(record.resetTime / 1000),
    allowed: record.count <= maxRequests
  };
}

async function redisConsume(redis, ip, maxRequests) {
  const bucket = getWindowBucket();
  const key = `ratelimit:${ip}:${bucket}`;
  const resetTime = Math.ceil(getResetTime(bucket) / 1000);
  const count = await redis.incr(key);

  if (count === 1) {
    await redis.pexpire(key, RATE_LIMIT.WINDOW_MS);
  }

  return {
    count,
    remaining: Math.max(0, maxRequests - count),
    resetTime,
    allowed: count <= maxRequests
  };
}

function buildHeaders(maxRequests, result) {
  return {
    'X-RateLimit-Limit': String(maxRequests),
    'X-RateLimit-Remaining': String(result.remaining),
    'X-RateLimit-Reset': String(result.resetTime)
  };
}

/**
 * Check and consume one request from the rate limit budget.
 * @returns {{ allowed: boolean, headers: Record<string,string>, retryAfter?: number, limit: number }}
 */
async function checkRateLimit(c, options = {}) {
  const isAuthenticated = Boolean(options.isAuthenticated);
  const redis = options.redis || null;
  const maxRequests = isAuthenticated ? RATE_LIMIT.MAX_REQUESTS_AUTH : RATE_LIMIT.MAX_REQUESTS;
  const ip = getClientIp(c);

  let result;
  try {
    result = redis ? await redisConsume(redis, ip, maxRequests) : memoryConsume(ip, maxRequests);
  } catch {
    result = memoryConsume(ip, maxRequests);
  }

  const headers = buildHeaders(maxRequests, result);
  if (!result.allowed) {
    headers['Retry-After'] = String(Math.max(1, result.resetTime - Math.floor(Date.now() / 1000)));
  }

  return {
    allowed: result.allowed,
    headers,
    retryAfter: result.allowed ? undefined : Number(headers['Retry-After']),
    limit: maxRequests
  };
}

/** @deprecated Prefer checkRateLimit — kept for compatibility */
function getRateLimitHeaders(c, isAuthenticated = false) {
  const ip = getClientIp(c);
  const maxRequests = isAuthenticated ? RATE_LIMIT.MAX_REQUESTS_AUTH : RATE_LIMIT.MAX_REQUESTS;
  const result = memoryConsume(ip, maxRequests);
  return buildHeaders(maxRequests, result);
}

function clearRateLimitStore() {
  rateLimitStore.clear();
}

module.exports = {
  RATE_LIMIT,
  checkRateLimit,
  getRateLimitHeaders,
  clearRateLimitStore,
  getClientIp
};
