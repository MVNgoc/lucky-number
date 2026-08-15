const axios = require('axios');

const { parseProvinceParam } = require('./daiService');

const BASE_URL = 'https://www.minhngoc.net.vn/ket-qua-xo-so';

const PAST_DAY_TTL_MS = 24 * 60 * 60 * 1000;
const TODAY_TTL_MS = 60 * 1000;
const MAX_CACHE_ENTRIES = 30;

const cache = new Map();

function todayDateParam() {
  const now = new Date();
  const pad = n => String(n).padStart(2, '0');
  return `${pad(now.getDate())}-${pad(now.getMonth() + 1)}-${now.getFullYear()}`;
}

function readCache(key) {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    cache.delete(key);
    return null;
  }
  cache.delete(key);
  cache.set(key, entry);
  return entry.html;
}

function writeCache(key, html, ttlMs) {
  cache.set(key, { html, expiresAt: Date.now() + ttlMs });
  while (cache.size > MAX_CACHE_ENTRIES) {
    cache.delete(cache.keys().next().value);
  }
}

function buildTargetUrl(date, province) {
  const parsed = parseProvinceParam(province);
  if (!parsed) return null;

  return parsed.slug
    ? `${BASE_URL}/${parsed.region}/${parsed.slug}/${date}.html`
    : `${BASE_URL}/${parsed.region}/${date}.html`;
}

async function fetchKqxsHtml(date, province) {
  if (!date || !province) {
    const err = new Error('Thiếu tham số.');
    err.statusCode = 400;
    throw err;
  }

  if (!/^\d{2}-\d{2}-\d{4}$/.test(date)) {
    const err = new Error('Ngày không hợp lệ.');
    err.statusCode = 400;
    throw err;
  }

  const targetUrl = buildTargetUrl(date, province);
  if (!targetUrl) {
    const err = new Error('Đài không hợp lệ.');
    err.statusCode = 400;
    throw err;
  }

  const cacheKey = `${province}|${date}`;
  const cached = readCache(cacheKey);
  if (cached) return cached;

  try {
    const response = await axios.get(targetUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      timeout: 10000
    });

    const ttlMs = date === todayDateParam() ? TODAY_TTL_MS : PAST_DAY_TTL_MS;
    writeCache(cacheKey, response.data, ttlMs);

    return response.data;
  } catch (error) {
    const err = new Error('Lỗi khi tải dữ liệu.');
    err.statusCode = 500;
    throw err;
  }
}

function clearKqxsCache() {
  cache.clear();
}

module.exports = {
  fetchKqxsHtml,
  buildTargetUrl,
  todayDateParam,
  clearKqxsCache
};
