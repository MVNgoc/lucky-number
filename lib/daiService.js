const axios = require('axios');

const BASE_URL = 'https://www.minhngoc.net.vn';
const HOME_URL = `${BASE_URL}/`;
const CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const FETCH_TIMEOUT_MS = 6000;

const WEEKDAY_PAGE_SLUGS = [
  'chu-nhat',
  'thu-hai',
  'thu-ba',
  'thu-tu',
  'thu-nam',
  'thu-sau',
  'thu-bay'
];

const REGIONS = [
  { slug: 'mien-nam', name: 'Xổ Số Miền Nam' },
  { slug: 'mien-trung', name: 'Xổ Số Miền Trung' },
  { slug: 'mien-bac', name: 'Xổ Số Miền Bắc' }
];

const REGION_SLUGS = REGIONS.map(r => r.slug);

const WEEKDAY_SLUGS = new Set([
  'thu-hai',
  'thu-ba',
  'thu-tu',
  'thu-nam',
  'thu-sau',
  'thu-bay',
  'chu-nhat'
]);
const DATE_SLUG_REGEX = /^\d{2}-\d{2}-\d{4}$/;

const PROVINCE_LINK_REGEX =
  /<a\s+href="\/ket-qua-xo-so\/(mien-nam|mien-trung|mien-bac)\/([a-z0-9-]+)\.html"[^>]*>([\s\S]*?)<\/a>/g;

const FALLBACK_PROVINCES = [
  ['mien-nam', 'an-giang', 'An Giang'],
  ['mien-nam', 'bac-lieu', 'Bạc Liêu'],
  ['mien-nam', 'ben-tre', 'Bến Tre'],
  ['mien-nam', 'binh-duong', 'Bình Dương'],
  ['mien-nam', 'binh-phuoc', 'Bình Phước'],
  ['mien-nam', 'binh-thuan', 'Bình Thuận'],
  ['mien-nam', 'ca-mau', 'Cà Mau'],
  ['mien-nam', 'can-tho', 'Cần Thơ'],
  ['mien-nam', 'da-lat', 'Đà Lạt'],
  ['mien-nam', 'dong-nai', 'Đồng Nai'],
  ['mien-nam', 'dong-thap', 'Đồng Tháp'],
  ['mien-nam', 'hau-giang', 'Hậu Giang'],
  ['mien-nam', 'kien-giang', 'Kiên Giang'],
  ['mien-nam', 'long-an', 'Long An'],
  ['mien-nam', 'soc-trang', 'Sóc Trăng'],
  ['mien-nam', 'tay-ninh', 'Tây Ninh'],
  ['mien-nam', 'tien-giang', 'Tiền Giang'],
  ['mien-nam', 'tp-hcm', 'TP. HCM'],
  ['mien-nam', 'tra-vinh', 'Trà Vinh'],
  ['mien-nam', 'vinh-long', 'Vĩnh Long'],
  ['mien-nam', 'vung-tau', 'Vũng Tàu'],
  ['mien-trung', 'binh-dinh', 'Bình Định'],
  ['mien-trung', 'da-nang', 'Đà Nẵng'],
  ['mien-trung', 'dak-lak', 'Đắk Lắk'],
  ['mien-trung', 'dak-nong', 'Đắk Nông'],
  ['mien-trung', 'gia-lai', 'Gia Lai'],
  ['mien-trung', 'khanh-hoa', 'Khánh Hòa'],
  ['mien-trung', 'kon-tum', 'Kon Tum'],
  ['mien-trung', 'ninh-thuan', 'Ninh Thuận'],
  ['mien-trung', 'phu-yen', 'Phú Yên'],
  ['mien-trung', 'quang-binh', 'Quảng Bình'],
  ['mien-trung', 'quang-nam', 'Quảng Nam'],
  ['mien-trung', 'quang-ngai', 'Quảng Ngãi'],
  ['mien-trung', 'quang-tri', 'Quảng Trị'],
  ['mien-trung', 'thua-thien-hue', 'Huế'],
  ['mien-bac', 'bac-ninh', 'Bắc Ninh'],
  ['mien-bac', 'ha-noi', 'Hà Nội'],
  ['mien-bac', 'hai-phong', 'Hải Phòng'],
  ['mien-bac', 'nam-dinh', 'Nam Định'],
  ['mien-bac', 'quang-ninh', 'Quảng Ninh'],
  ['mien-bac', 'thai-binh', 'Thái Bình']
].map(([region, slug, name]) => ({ region, slug, name }));

const FALLBACK_SCHEDULE = [
  ['tien-giang', 'kien-giang', 'da-lat', 'kon-tum', 'thua-thien-hue',
   'khanh-hoa', 'thai-binh'],
  ['tp-hcm', 'dong-thap', 'ca-mau', 'phu-yen', 'thua-thien-hue', 'ha-noi'],
  ['ben-tre', 'vung-tau', 'bac-lieu', 'dak-lak', 'quang-nam', 'quang-ninh'],
  ['dong-nai', 'can-tho', 'soc-trang', 'da-nang', 'khanh-hoa', 'bac-ninh'],
  ['tay-ninh', 'an-giang', 'binh-thuan', 'binh-dinh', 'quang-tri',
   'quang-binh', 'ha-noi'],
  ['vinh-long', 'binh-duong', 'tra-vinh', 'gia-lai', 'ninh-thuan', 'hai-phong'],
  ['tp-hcm', 'long-an', 'binh-phuoc', 'hau-giang', 'da-nang', 'quang-ngai',
   'dak-nong', 'nam-dinh']
];

let cache = { data: null, fetchedAt: 0 };
const scheduleCache = {};

const scrapeStatus = {
  provinces: { ok: null, source: null, at: null, error: null },
  schedule: { ok: null, source: null, at: null, error: null }
};

function markScrape(part, { ok, source, error = null }) {
  scrapeStatus[part] = {
    ok,
    source,
    at: new Date().toISOString(),
    error: error ? String(error).slice(0, 200) : null
  };
  if (!ok) {
    console.error(
      `⚠️  FALLBACK [${part}] đang dùng "${source}" — minhngoc không parse được: ${error}`
    );
  }
}

function getScrapeStatus() {
  return {
    provinces: { ...scrapeStatus.provinces },
    schedule: { ...scrapeStatus.schedule },
    usingFallback:
      scrapeStatus.provinces.source === 'fallback' ||
      scrapeStatus.schedule.source === 'fallback'
  };
}

const COMBINING_ACCENTS = {
  grave: '\u0300',
  acute: '\u0301',
  circ: '\u0302',
  tilde: '\u0303',
  macr: '\u0304',
  breve: '\u0306',
  uml: '\u0308',
  ring: '\u030a',
  caron: '\u030c',
  cedil: '\u0327',
  ogon: '\u0328'
};

function decodeEntities(text) {
  return text
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) =>
      String.fromCodePoint(parseInt(hex, 16))
    )
    .replace(
      new RegExp(`&([a-zA-Z])(${Object.keys(COMBINING_ACCENTS).join('|')});`, 'g'),
      (whole, letter, accent) =>
        (letter + COMBINING_ACCENTS[accent]).normalize('NFC')
    )
    .replace(/&nbsp;/g, ' ')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');
}

function cleanProvinceName(rawText) {
  return decodeEntities(rawText)
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^(kết quả xổ số|kqxs|xổ số)\s+/i, '')
    .trim();
}

function parseProvinces(html) {
  const seen = new Set();
  const provinces = [];
  let match;

  PROVINCE_LINK_REGEX.lastIndex = 0;
  while ((match = PROVINCE_LINK_REGEX.exec(html)) !== null) {
    const [, region, slug, rawText] = match;
    if (WEEKDAY_SLUGS.has(slug) || DATE_SLUG_REGEX.test(slug)) continue;

    const key = `${region}/${slug}`;
    if (seen.has(key)) continue;

    const name = cleanProvinceName(rawText);
    if (!name) continue;

    seen.add(key);
    provinces.push({ region, slug, name });
  }

  return provinces;
}

function groupByRegion(provinces) {
  return REGIONS.map(region => ({
    region: region.slug,
    regionName: region.name,
    provinces: provinces
      .filter(p => p.region === region.slug)
      .sort((a, b) => a.name.localeCompare(b.name, 'vi'))
  })).filter(group => group.provinces.length > 0);
}

async function fetchDaiList() {
  const isFresh = cache.data && Date.now() - cache.fetchedAt < CACHE_TTL_MS;
  if (isFresh) return cache.data;

  try {
    const response = await axios.get(HOME_URL, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      timeout: FETCH_TIMEOUT_MS
    });
    const provinces = parseProvinces(response.data);

    if (provinces.length < 20) {
      throw new Error(`Chỉ parse được ${provinces.length} đài.`);
    }

    cache = { data: groupByRegion(provinces), fetchedAt: Date.now() };
    markScrape('provinces', { ok: true, source: 'minhngoc' });
    console.log(`✅ Đã cập nhật danh sách đài: ${provinces.length} đài`);
    return cache.data;
  } catch (err) {
    if (cache.data) {
      markScrape('provinces', {
        ok: false,
        source: 'cache-cũ',
        error: err.message
      });
      return cache.data;
    }
    markScrape('provinces', {
      ok: false,
      source: 'fallback',
      error: err.message
    });
    return groupByRegion(FALLBACK_PROVINCES);
  }
}

function parseScheduleSlugs(html) {
  const start = html.indexOf('<div class="box_kqxs"');
  if (start < 0) return [];

  const next = html.indexOf('<div class="box_kqxs"', start + 10);
  const box = html.slice(start, next < 0 ? undefined : next);

  const slugs = [];
  const provinceTableRegex =
    /<td class="tinh">[\s\S]*?href="\/xo-so-[a-z-]+\/([a-z0-9-]+)\.html"/g;
  let match;
  while ((match = provinceTableRegex.exec(box)) !== null) {
    if (!slugs.includes(match[1])) slugs.push(match[1]);
  }
  if (slugs.length > 0) return slugs;

  const titleRegex =
    /<div class="title">[\s\S]*?href="\/ket-qua-xo-so\/(?:mien-nam|mien-trung|mien-bac)\/([a-z0-9-]+)\.html"/;
  const single = box.match(titleRegex);
  if (single && !DATE_SLUG_REGEX.test(single[1]) && !WEEKDAY_SLUGS.has(single[1])) {
    return [single[1]];
  }

  return [];
}

async function fetchRegionSchedule(region, weekday) {
  const url = `${BASE_URL}/ket-qua-xo-so/${region}/${WEEKDAY_PAGE_SLUGS[weekday]}.html`;
  const response = await axios.get(url, {
    headers: { 'User-Agent': 'Mozilla/5.0' },
    timeout: FETCH_TIMEOUT_MS
  });
  return parseScheduleSlugs(response.data);
}

async function fetchScheduleSlugs(weekday) {
  const cached = scheduleCache[weekday];
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) return cached.slugs;

  try {
    const perRegion = await Promise.all(
      REGION_SLUGS.map(region => fetchRegionSchedule(region, weekday))
    );
    const slugs = new Set(perRegion.flat());

    if (slugs.size === 0) throw new Error('Không parse được đài nào.');

    scheduleCache[weekday] = { slugs, fetchedAt: Date.now() };
    markScrape('schedule', { ok: true, source: 'minhngoc' });
    return slugs;
  } catch (err) {
    if (cached) {
      markScrape('schedule', {
        ok: false,
        source: 'cache-cũ',
        error: `thứ ${weekday}: ${err.message}`
      });
      return cached.slugs;
    }
    markScrape('schedule', {
      ok: false,
      source: 'fallback',
      error: `thứ ${weekday}: ${err.message}`
    });
    return new Set(FALLBACK_SCHEDULE[weekday]);
  }
}

async function fetchDaiListForWeekday(weekday) {
  if (weekday === null) {
    const groups = await fetchDaiList();
    return { groups, weekday: null, status: getScrapeStatus() };
  }

  const [groups, slugs] = await Promise.all([
    fetchDaiList(),
    fetchScheduleSlugs(weekday)
  ]);
  const filtered = groups
    .map(group => ({
      ...group,
      provinces: group.provinces.filter(p => slugs.has(p.slug))
    }))
    .filter(group => group.provinces.length > 0);

  if (filtered.length === 0) {
    return { groups, weekday, status: getScrapeStatus() };
  }

  return { groups: filtered, weekday, status: getScrapeStatus() };
}

function weekdayFromDateParam(date) {
  if (typeof date !== 'string' || !DATE_SLUG_REGEX.test(date)) return null;

  const [day, month, year] = date.split('-').map(Number);
  const parsed = new Date(year, month - 1, day);
  if (
    parsed.getFullYear() !== year ||
    parsed.getMonth() !== month - 1 ||
    parsed.getDate() !== day
  ) {
    return null;
  }
  return parsed.getDay();
}

function normalizeName(name) {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\u0111/gi, 'd')
    .toLowerCase()
    .replace(/(xo so|xskt|kien thiet|cong ty|dai|tinh|thanh pho|tp)/g, '')
    .replace(/[^a-z0-9]/g, '');
}

const NAME_ALIASES = {
  tphochiminh: 'tp-hcm',
  hochiminh: 'tp-hcm',
  saigon: 'tp-hcm',
  hcm: 'tp-hcm',
  lamdong: 'da-lat',
  thuathienhue: 'thua-thien-hue',
  hue: 'thua-thien-hue',
  batriavungtau: 'vung-tau',
  bariavungtau: 'vung-tau',
  daklak: 'dak-lak',
  daclac: 'dak-lak',
  daknong: 'dak-nong'
};

async function findProvinceByName(name, provinces = null) {
  if (typeof name !== 'string' || !name.trim()) return null;

  const all = provinces || (await fetchDaiList()).flatMap(g => g.provinces);
  const target = normalizeName(name);
  if (!target) return null;

  const aliasSlug = NAME_ALIASES[target];
  const bySlug = slug => all.find(p => p.slug === slug) || null;
  if (aliasSlug) return bySlug(aliasSlug);

  const exact = all.find(p => normalizeName(p.name) === target);
  if (exact) return exact;

  const contains = all.filter(p => {
    const candidate = normalizeName(p.name);
    return candidate.length >= 4 && target.includes(candidate);
  });
  return contains.length === 1 ? contains[0] : null;
}

function parseProvinceParam(province) {
  if (typeof province !== 'string') return null;

  const parts = province.split('/');
  if (parts.length > 2) return null;
  if (!REGION_SLUGS.includes(parts[0])) return null;
  if (parts.length === 2 && !/^[a-z0-9-]+$/.test(parts[1])) return null;

  return { region: parts[0], slug: parts[1] || null };
}

module.exports = {
  REGIONS,
  REGION_SLUGS,
  FALLBACK_PROVINCES,
  parseProvinces,
  parseScheduleSlugs,
  groupByRegion,
  fetchDaiList,
  fetchDaiListForWeekday,
  normalizeName,
  findProvinceByName,
  getScrapeStatus,
  weekdayFromDateParam,
  parseProvinceParam
};
