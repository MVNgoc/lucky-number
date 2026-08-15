const { readTicketImage } = require('./aiService');
const { findProvinceByName, fetchDaiList } = require('./daiService');

async function readTicket(imageBase64, mimeType) {
  const provincesPromise = fetchDaiList()
    .then(groups => groups.flatMap(g => g.provinces))
    .catch(() => null);

  const { soVe, dai, ngay } = await readTicketImage(imageBase64, mimeType);
  const province = dai
    ? await findProvinceByName(dai, await provincesPromise)
    : null;

  return {
    soVe,
    ngay,
    daiText: dai,
    province: province ? `${province.region}/${province.slug}` : null,
    provinceName: province ? province.name : null
  };
}

module.exports = { readTicket };
