const { readTicketImage } = require('./aiService');
const { findProvinceByName } = require('./daiService');

async function readTicket(imageBase64, mimeType) {
  const { soVe, dai, ngay } = await readTicketImage(imageBase64, mimeType);
  const province = dai ? await findProvinceByName(dai) : null;

  return {
    soVe,
    ngay,
    daiText: dai,
    province: province ? `${province.region}/${province.slug}` : null,
    provinceName: province ? province.name : null
  };
}

module.exports = { readTicket };
