const test = require('node:test');
const assert = require('node:assert');

const {
  isValidTicketJson,
  normalizeReadTicket,
  TICKET_NUMBER_REGEX
} = require('../lib/aiService');

test('TICKET_NUMBER_REGEX chỉ nhận 5-6 chữ số', () => {
  ['12345', '123456'].forEach(n =>
    assert.ok(TICKET_NUMBER_REGEX.test(n), `${n} phải hợp lệ`)
  );
  ['1234', '1234567', '12a45', '', ' 12345', '12 345'].forEach(n =>
    assert.ok(!TICKET_NUMBER_REGEX.test(n), `${n} phải bị loại`)
  );
});

test('isValidTicketJson nhận JSON có soVe, kể cả bọc trong ```json', () => {
  assert.ok(isValidTicketJson('{"soVe":"123456","dai":"Bến Tre","ngay":null}'));
  assert.ok(isValidTicketJson('```json\n{"soVe":null}\n```'));
  assert.ok(isValidTicketJson('  {"soVe":"1"}  '));
});

test('isValidTicketJson loại output không dùng được', () => {
  for (const text of [
    'Đây là số vé của bạn: 123456',
    '{"khong_co_soVe":"x"}',
    '[{"soVe":"123456"}]',
    '{"soVe": }',
    'null',
    ''
  ]) {
    assert.ok(!isValidTicketJson(text), `${JSON.stringify(text)} phải bị loại`);
  }
});

test('normalizeReadTicket lọc rác quanh dãy số', () => {
  assert.strictEqual(normalizeReadTicket({ soVe: ' 418 305 ' }).soVe, '418305');
  assert.strictEqual(normalizeReadTicket({ soVe: '12-345' }).soVe, '12345');
});

test('normalizeReadTicket trả null khi dãy số sai độ dài', () => {
  for (const soVe of ['1234', '1234567', 'abc', '', null, undefined, 123456]) {
    assert.strictEqual(
      normalizeReadTicket({ soVe }).soVe,
      null,
      `soVe=${JSON.stringify(soVe)} phải thành null`
    );
  }
});

test('normalizeReadTicket chỉ nhận ngày DD/MM/YYYY có thật', () => {
  assert.strictEqual(normalizeReadTicket({ ngay: '05/08/2026' }).ngay, '05/08/2026');

  for (const ngay of [
    '31/02/2026',
    '32/01/2026',
    '00/01/2026',
    '01/13/2026',
    '5/8/2026',
    '2026-08-05',
    'hôm qua',
    '',
    null,
    20260805
  ]) {
    assert.strictEqual(
      normalizeReadTicket({ ngay }).ngay,
      null,
      `ngay=${JSON.stringify(ngay)} phải thành null`
    );
  }
});

test('normalizeReadTicket giữ tên đài đã trim, rỗng thì null', () => {
  assert.strictEqual(normalizeReadTicket({ dai: '  Bến Tre  ' }).dai, 'Bến Tre');
  for (const dai of ['', '   ', null, undefined, 123]) {
    assert.strictEqual(normalizeReadTicket({ dai }).dai, null);
  }
});

test('normalizeReadTicket luôn trả đủ 3 khoá', () => {
  assert.deepStrictEqual(normalizeReadTicket({}), {
    soVe: null,
    dai: null,
    ngay: null
  });
});
