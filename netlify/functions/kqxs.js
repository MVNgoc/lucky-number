const { fetchKqxsHtml } = require('../../lib/kqxsService');

exports.handler = async event => {
  const { date, province } = event.queryStringParameters || {};

  try {
    const html = await fetchKqxsHtml(date, province);
    return { statusCode: 200, body: html };
  } catch (error) {
    return { statusCode: error.statusCode || 500, body: error.message };
  }
};
