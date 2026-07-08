const axios = require('axios');

async function fetchKqxsHtml(date, province) {
  if (!date || !province) {
    const err = new Error('Thiếu tham số.');
    err.statusCode = 400;
    throw err;
  }

  const targetUrl =
    province === 'mien-bac'
      ? `https://www.minhngoc.net.vn/ket-qua-xo-so/mien-bac/${date}.html`
      : `https://www.minhngoc.net.vn/ket-qua-xo-so/mien-nam/${province}/${date}.html`;

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

module.exports = { fetchKqxsHtml };
