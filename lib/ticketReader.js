const { readTicketImage } = require('./aiService');
const { findProvinceByName } = require('./daiService');

// Đọc ảnh vé -> số vé + đài (đã khớp về region/slug) + ngày mở thưởng.
// Trường nào không đọc được chắc chắn thì trả null để client tự để người dùng
// nhập tay, thay vì điền một giá trị đoán bừa.
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
