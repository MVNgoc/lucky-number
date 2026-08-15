const {
  fetchDaiListForWeekday,
  getScrapeStatus
} = require('../../lib/daiService');

exports.handler = async () => {
  await fetchDaiListForWeekday(new Date().getDay());
  const status = getScrapeStatus();

  return {
    statusCode: status.usingFallback ? 503 : 200,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store'
    },
    body: JSON.stringify(status)
  };
};
