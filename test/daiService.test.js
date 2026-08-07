const test = require('node:test');
const assert = require('node:assert');

const {
  parseProvinces,
  parseScheduleSlugs,
  groupByRegion,
  normalizeName,
  findProvinceByName,
  weekdayFromDateParam,
  parseProvinceParam,
  FALLBACK_PROVINCES
} = require('../lib/daiService');

const {
  HOME_HTML,
  WEEKDAY_MULTI_PROVINCE_HTML,
  WEEKDAY_SINGLE_PROVINCE_HTML,
  EMPTY_HTML
} = require('./fixtures');

test('parseProvinces bóc đúng đài kèm miền', () => {
  const provinces = parseProvinces(HOME_HTML);
  const slugs = provinces.map(p => `${p.region}/${p.slug}`);

  assert.ok(slugs.includes('mien-nam/an-giang'));
  assert.ok(slugs.includes('mien-trung/da-nang'));
  assert.ok(slugs.includes('mien-bac/ha-noi'));
});

test('parseProvinces bỏ link theo thứ và theo ngày', () => {
  const slugs = parseProvinces(HOME_HTML).map(p => p.slug);

  assert.ok(!slugs.includes('thu-hai'));
  assert.ok(!slugs.includes('chu-nhat'));
  assert.ok(!slugs.includes('06-08-2026'));
});

test('parseProvinces cắt tiền tố và giải mã entity trong tên', () => {
  const bySlug = Object.fromEntries(
    parseProvinces(HOME_HTML).map(p => [p.slug, p.name])
  );

  assert.strictEqual(bySlug['an-giang'], 'An Giang');
  assert.strictEqual(bySlug['tp-hcm'], 'TP. HCM');
  assert.strictEqual(bySlug['bac-ninh'], 'Bắc Ninh', 'phải cắt cả "KQXS "');
  assert.strictEqual(bySlug['ha-noi'], 'Hà Nội', '&agrave; phải thành à');
});

test('parseProvinces không trả đài trùng', () => {
  const slugs = parseProvinces(HOME_HTML)
    .filter(p => p.slug === 'an-giang')
    .map(p => p.slug);

  assert.strictEqual(slugs.length, 1, 'an-giang xuất hiện 2 lần trong HTML');
});

test('groupByRegion giữ thứ tự miền và sắp tên theo tiếng Việt', () => {
  const groups = groupByRegion(parseProvinces(HOME_HTML));

  assert.deepStrictEqual(
    groups.map(g => g.region),
    ['mien-nam', 'mien-trung', 'mien-bac']
  );

  const mienNam = groups[0].provinces.map(p => p.name);
  const sorted = [...mienNam].sort((a, b) => a.localeCompare(b, 'vi'));
  assert.deepStrictEqual(mienNam, sorted);
});

test('parseScheduleSlugs đọc bảng nhiều tỉnh, chỉ lấy kỳ quay gần nhất', () => {
  const slugs = parseScheduleSlugs(WEEKDAY_MULTI_PROVINCE_HTML);

  assert.deepStrictEqual(slugs, ['dong-nai', 'can-tho', 'soc-trang']);
  assert.ok(
    !slugs.includes('vinh-long'),
    'vinh-long ở box thứ 2 (kỳ trước) nên phải bị bỏ'
  );
});

test('parseScheduleSlugs đọc được trang 1 đài của Miền Bắc', () => {
  assert.deepStrictEqual(parseScheduleSlugs(WEEKDAY_SINGLE_PROVINCE_HTML), [
    'bac-ninh'
  ]);
});

test('parseScheduleSlugs trả rỗng khi trang không có box_kqxs', () => {
  assert.deepStrictEqual(parseScheduleSlugs(EMPTY_HTML), []);
  assert.deepStrictEqual(parseScheduleSlugs(''), []);
});

test('normalizeName bỏ dấu, bỏ chữ mô tả, bỏ ký tự lạ', () => {
  assert.strictEqual(normalizeName('Đà Nẵng'), 'danang');
  assert.strictEqual(normalizeName('CÔNG TY XSKT TIỀN GIANG'), 'tiengiang');
  assert.strictEqual(normalizeName('TP. HCM'), 'hcm');
});

test('findProvinceByName khớp tên thẳng và tên có dấu', async () => {
  const p = await findProvinceByName('Đà Nẵng', FALLBACK_PROVINCES);
  assert.deepStrictEqual([p.region, p.slug], ['mien-trung', 'da-nang']);
});

test('findProvinceByName xử lý được các cách in trên vé', async () => {
  const cases = [
    ['XSKT LÂM ĐỒNG', 'da-lat'],
    ['CÔNG TY XSKT TIỀN GIANG', 'tien-giang'],
    ['TP. HỒ CHÍ MINH', 'tp-hcm'],
    ['Thừa Thiên Huế', 'thua-thien-hue'],
    ['BÀ RỊA VŨNG TÀU', 'vung-tau'],
    ['XSKT SÓC TRĂNG 8K1', 'soc-trang']
  ];

  for (const [input, expected] of cases) {
    const found = await findProvinceByName(input, FALLBACK_PROVINCES);
    assert.strictEqual(found?.slug, expected, `"${input}" phải ra ${expected}`);
  }
});

test('findProvinceByName trả null khi không chắc chắn', async () => {
  for (const input of ['', '   ', 'Tỉnh Nào Đó', 'Quảng', null, undefined, 42]) {
    assert.strictEqual(
      await findProvinceByName(input, FALLBACK_PROVINCES),
      null,
      `"${input}" phải trả null chứ không được đoán`
    );
  }
});

test('weekdayFromDateParam trả đúng thứ', () => {
  assert.strictEqual(weekdayFromDateParam('07-08-2026'), 5, '07/08/2026 là T6');
  assert.strictEqual(weekdayFromDateParam('05-08-2026'), 3, '05/08/2026 là T4');
  assert.strictEqual(weekdayFromDateParam('02-08-2026'), 0, '02/08/2026 là CN');
});

test('weekdayFromDateParam loại ngày không tồn tại và định dạng sai', () => {
  for (const input of [
    '31-02-2026',
    '32-01-2026',
    '00-01-2026',
    '01-13-2026',
    '1-1-2026',
    '2026-08-07',
    'abc',
    '',
    null,
    undefined,
    12345
  ]) {
    assert.strictEqual(
      weekdayFromDateParam(input),
      null,
      `"${input}" phải trả null`
    );
  }
});

test('parseProvinceParam nhận miền và miền/đài', () => {
  assert.deepStrictEqual(parseProvinceParam('mien-bac'), {
    region: 'mien-bac',
    slug: null
  });
  assert.deepStrictEqual(parseProvinceParam('mien-trung/da-nang'), {
    region: 'mien-trung',
    slug: 'da-nang'
  });
});

test('parseProvinceParam chặn đường dẫn lạ', () => {
  for (const input of [
    '../../etc/passwd',
    'mien-nam/../../x',
    'mien-nam/a/b',
    'evil.com',
    'MIEN-NAM',
    'mien-nam/Đà-Nẵng',
    '',
    null,
    undefined,
    {}
  ]) {
    assert.strictEqual(
      parseProvinceParam(input),
      null,
      `"${input}" phải bị từ chối`
    );
  }
});
