
const LIMITS = {
  'doc-ve': { max: 10, windowMs: 5 * 60 * 1000 },
  'phan-tich-ai': { max: 25, windowMs: 5 * 60 * 1000 }
};

const hits = new Map();

const MAX_TRACKED_KEYS = 5000;

function pruneOldKeys(now) {
  for (const [key, timestamps] of hits) {
    if (timestamps.length === 0 || now - timestamps[timestamps.length - 1] > 60 * 60 * 1000) {
      hits.delete(key);
    }
  }
}

function getClientIp(headers = {}, fallback = 'unknown') {
  const normalized = {};
  for (const [name, value] of Object.entries(headers)) {
    normalized[name.toLowerCase()] = value;
  }

  const direct = normalized['x-nf-client-connection-ip'];
  if (direct) return direct;

  const forwarded = normalized['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.trim()) {
    return forwarded.split(',')[0].trim();
  }

  return fallback;
}

function checkRateLimit(bucket, clientIp) {
  const limit = LIMITS[bucket];
  if (!limit) return { allowed: true };

  const now = Date.now();
  if (hits.size > MAX_TRACKED_KEYS) pruneOldKeys(now);

  const key = `${bucket}:${clientIp}`;
  const windowStart = now - limit.windowMs;
  const recent = (hits.get(key) || []).filter(time => time > windowStart);

  if (recent.length >= limit.max) {
    const oldest = recent[0];
    const retryAfterSeconds = Math.max(
      1,
      Math.ceil((oldest + limit.windowMs - now) / 1000)
    );
    hits.set(key, recent);
    return { allowed: false, retryAfterSeconds };
  }

  recent.push(now);
  hits.set(key, recent);
  return { allowed: true };
}

function rateLimitMessage(retryAfterSeconds) {
  const minutes = Math.ceil(retryAfterSeconds / 60);
  return `Bạn dùng hơi nhanh, thử lại sau ${minutes} phút nhé.`;
}

function resetRateLimit() {
  hits.clear();
}

module.exports = {
  LIMITS,
  getClientIp,
  checkRateLimit,
  rateLimitMessage,
  resetRateLimit
};
