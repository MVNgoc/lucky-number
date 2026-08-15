const {
  fetchDaiListForWeekday,
  weekdayFromDateParam
} = require('../../lib/daiService');

exports.handler = async event => {
  const { date } = event.queryStringParameters || {};
  const weekday = weekdayFromDateParam(date);
  const payload = await fetchDaiListForWeekday(weekday);

  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'public, max-age=0, s-maxage=21600'
    },
    body: JSON.stringify(payload)
  };
};
