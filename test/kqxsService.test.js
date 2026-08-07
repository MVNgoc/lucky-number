const test = require('node:test');
const assert = require('node:assert');

const { buildTargetUrl, todayDateParam } = require('../lib/kqxsService');
const {
  checkRateLimit,
  getClientIp,
  resetRateLimit,
  LIMITS
} = require('../lib/rateLimit');

const BASE = 'https://www.minhngoc.net.vn/ket-qua-xo-so';

test('buildTargetUrl ghép đúng đường dẫn có miền', () => {
  assert.strictEqual(
    buildTargetUrl('05-08-2026', 'mien-trung/da-nang'),
    `${BASE}/mien-trung/da-nang/05-08-2026.html`
  );
  assert.strictEqual(
    buildTargetUrl('05-08-2026', 'mien-bac/ha-noi'),
    `${BASE}/mien-bac/ha-noi/05-08-2026.html`
  );
});

test('buildTargetUrl hỗ trợ trang cả miền', () => {
  assert.strictEqual(
    buildTargetUrl('05-08-2026', 'mien-bac'),
    `${BASE}/mien-bac/05-08-2026.html`
  );
});

test('buildTargetUrl trả null với đài không hợp lệ', () => {
  for (const province of ['../../evil', 'mien-nam/a/b', 'evil.com', '', null]) {
    assert.strictEqual(buildTargetUrl('05-08-2026', province), null);
  }
});

test('todayDateParam trả DD-MM-YYYY', () => {
  assert.match(todayDateParam(), /^\d{2}-\d{2}-\d{4}$/);
});

test('checkRateLimit cho qua tới hạn rồi chặn', () => {
  resetRateLimit();
  const max = LIMITS['doc-ve'].max;

  for (let i = 0; i < max; i++) {
    assert.strictEqual(
      checkRateLimit('doc-ve', '1.2.3.4').allowed,
      true,
      `request ${i + 1} phải được qua`
    );
  }

  const blocked = checkRateLimit('doc-ve', '1.2.3.4');
  assert.strictEqual(blocked.allowed, false);
  assert.ok(blocked.retryAfterSeconds > 0, 'phải có Retry-After');
});

test('checkRateLimit đếm riêng theo IP và theo endpoint', () => {
  resetRateLimit();
  for (let i = 0; i < LIMITS['doc-ve'].max; i++) {
    checkRateLimit('doc-ve', '1.1.1.1');
  }

  assert.strictEqual(checkRateLimit('doc-ve', '1.1.1.1').allowed, false);
  assert.strictEqual(
    checkRateLimit('doc-ve', '2.2.2.2').allowed,
    true,
    'IP khác không bị ảnh hưởng'
  );
  assert.strictEqual(
    checkRateLimit('phan-tich-ai', '1.1.1.1').allowed,
    true,
    'endpoint khác đếm riêng'
  );
});

test('checkRateLimit bỏ qua bucket lạ', () => {
  resetRateLimit();
  assert.strictEqual(checkRateLimit('khong-ton-tai', '1.1.1.1').allowed, true);
});

test('getClientIp ưu tiên header của Netlify', () => {
  assert.strictEqual(
    getClientIp({
      'x-nf-client-connection-ip': '9.9.9.9',
      'x-forwarded-for': '8.8.8.8'
    }),
    '9.9.9.9'
  );
});

test('getClientIp lấy IP đầu trong x-forwarded-for', () => {
  assert.strictEqual(
    getClientIp({ 'X-Forwarded-For': '8.8.8.8, 10.0.0.1, 172.16.0.1' }),
    '8.8.8.8',
    'tên header không phân biệt hoa thường'
  );
});

test('getClientIp dùng giá trị dự phòng khi không có header', () => {
  assert.strictEqual(getClientIp({}, '127.0.0.1'), '127.0.0.1');
  assert.strictEqual(getClientIp({ 'x-forwarded-for': '  ' }, 'fb'), 'fb');
  assert.strictEqual(getClientIp(undefined, 'fb'), 'fb');
});
