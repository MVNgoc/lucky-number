const { readTicket } = require('../../lib/ticketReader');

exports.handler = async event => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const { image, mimeType } = JSON.parse(event.body || '{}');
    const result = await readTicket(image, mimeType);
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(result)
    };
  } catch (e) {
    console.error('Lỗi đọc vé:', e);
    return {
      statusCode: e.statusCode || 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        error: e.statusCode ? e.message : 'Không đọc được ảnh vé.'
      })
    };
  }
};
