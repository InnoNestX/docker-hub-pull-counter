const cacheStore = new Map();
const DEFAULT_TTL = 5 * 60 * 1000;

function isExpired(entry) {
  return Boolean(entry && entry.expiresAt && entry.expiresAt <= Date.now());
}

function cleanupExpired() {
  for (const [key, entry] of cacheStore.entries()) {
    if (isExpired(entry)) {
      cacheStore.delete(key);
    }
  }
}

function get(key) {
  const entry = cacheStore.get(key);
  if (!entry) {
    return null;
  }
  if (isExpired(entry)) {
    cacheStore.delete(key);
    return null;
  }
  return entry.value;
}

function set(key, value, ttl = DEFAULT_TTL) {
  const ttlMs = Number(ttl);
  const expiresAt = Number.isFinite(ttlMs) && ttlMs > 0 ? Date.now() + ttlMs : 0;
  cacheStore.set(key, { value, expiresAt });
  return value;
}

function remove(key) {
  cacheStore.delete(key);
}

function clear() {
  cacheStore.clear();
}

const cleanupTimer = setInterval(cleanupExpired, 60 * 1000);
if (typeof cleanupTimer.unref === 'function') {
  cleanupTimer.unref();
}

module.exports = { get, set, delete: remove, clear, cleanupExpired };
