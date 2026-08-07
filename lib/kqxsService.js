const axios = require('axios');

const { parseProvinceParam } = require('./daiService');

const BASE_URL = 'https://www.minhngoc.net.vn/ket-qua-xo-so';

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

  try {
    const response = await axios.get(targetUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      timeout: 10000
    });
    return response.data;
  } catch (error) {
    const err = new Error('Lỗi khi tải dữ liệu.');
    err.statusCode = 500;
    throw err;
  }
}

module.exports = { fetchKqxsHtml, buildTargetUrl };
