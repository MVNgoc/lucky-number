const {
  fetchDaiListForWeekday,
  getScrapeStatus
} = require('../../lib/daiService');

exports.handler = async () => {
  // Function khởi động lạnh chưa scrape lần nào -> status còn rỗng, phải gọi
  // một lần để biết parser có còn khớp với minhngoc hay không
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
