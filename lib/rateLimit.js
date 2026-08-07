// Giới hạn tần suất theo IP cho các endpoint gọi Gemini. Không có cái này thì
// một vòng lặp curl là cháy hết quota API, và /api/doc-ve còn tốn nhiều token
// hơn hẳn vì phải gửi cả ảnh.
//
// Lưu ý: bộ đếm nằm trong RAM của tiến trình. Trên Express (1 tiến trình) là
// chính xác; trên Netlify mỗi instance đếm riêng nên hạn mức thực tế bị nhân
// lên theo số instance. Vẫn chặn được lạm dụng từ một nguồn, nhưng muốn chặt
// thì phải dùng rate limiting ở tầng CDN hoặc một store dùng chung.

const LIMITS = {
  // Đọc ảnh vé: tốn nhất, người dùng thật cũng chỉ chụp vài lần
  'doc-ve': { max: 10, windowMs: 5 * 60 * 1000 },
  // Phân tích: mỗi lần dò vé gọi 1 lần
  'phan-tich-ai': { max: 25, windowMs: 5 * 60 * 1000 }
};

// key -> mảng timestamp các request còn trong cửa sổ
const hits = new Map();

// Chặn Map phình vô hạn khi bị rải nhiều IP khác nhau
const MAX_TRACKED_KEYS = 5000;

function pruneOldKeys(now) {
  for (const [key, timestamps] of hits) {
    if (timestamps.length === 0 || now - timestamps[timestamps.length - 1] > 60 * 60 * 1000) {
      hits.delete(key);
    }
  }
}

// Lấy IP client. Netlify đặt x-nf-client-connection-ip; sau proxy thì lấy IP
// đầu tiên trong x-forwarded-for.
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

// Trả { allowed: true } hoặc { allowed: false, retryAfterSeconds }
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

// Dùng trong test để bắt đầu từ trạng thái sạch
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
