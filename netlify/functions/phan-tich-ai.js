const { analyzeTicket } = require('../../lib/aiService');
const {
  getClientIp,
  checkRateLimit,
  rateLimitMessage
} = require('../../lib/rateLimit');

exports.handler = async event => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  const limit = checkRateLimit('phan-tich-ai', getClientIp(event.headers));
  if (!limit.allowed) {
    return {
      statusCode: 429,
      headers: {
        'Content-Type': 'application/json',
        'Retry-After': String(limit.retryAfterSeconds)
      },
      body: JSON.stringify({ error: rateLimitMessage(limit.retryAfterSeconds) })
    };
  }

  try {
    const { userNumber, isWinning, details } = JSON.parse(event.body || '{}');
    const aiText = await analyzeTicket(userNumber, isWinning, details);
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ aiText })
    };
  } catch (e) {
    console.error('Lỗi cuối cùng:', e);
    return {
      statusCode: e.statusCode || 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        error: e.statusCode ? e.message : 'Không thể phân tích AI vào lúc này.'
      })
    };
  }
};
