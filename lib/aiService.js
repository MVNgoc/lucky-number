const axios = require('axios');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const TICKET_NUMBER_REGEX = /^\d{5,6}$/;

const PREFERRED_MODEL = 'gemini-2.5-flash-lite';
const FALLBACK_MODELS = [
  'gemini-2.5-flash',
  'gemini-2.0-flash',
  'gemini-2.5-flash-lite',
  'gemini-flash-lite-latest'
];

let availableModels = [...FALLBACK_MODELS];

function getGenAI() {
  return new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
}

async function refreshModelList() {
  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${process.env.GEMINI_API_KEY}`;
    const response = await axios.get(url);
    availableModels = response.data.models
      .filter(m => m.supportedGenerationMethods.includes('generateContent'))
      .map(m => m.name.replace('models/', ''));
    console.log('✅ Đã cập nhật danh sách model:', availableModels);
  } catch (err) {
    console.error('❌ Không thể lấy danh sách model, dùng danh sách dự phòng.');
  }
}

async function getResponseFromModel(prompt) {
  const genAI = getGenAI();

  try {
    console.log(`Đang thử model ưu tiên (Lite): ${PREFERRED_MODEL}...`);
    const model = genAI.getGenerativeModel({ model: PREFERRED_MODEL });
    const result = await model.generateContent(prompt);
    return result.response.text();
  } catch (error) {
    console.error(`Model ưu tiên ${PREFERRED_MODEL} thất bại:`, error.message);
  }

  console.log('Đang chuyển sang danh sách model dự phòng...');
  for (const modelName of availableModels) {
    if (modelName === PREFERRED_MODEL) continue;

    try {
      console.log(`Đang thử model dự phòng: ${modelName}...`);
      const model = genAI.getGenerativeModel({ model: modelName });
      const result = await model.generateContent(prompt);
      return result.response.text();
    } catch (error) {
      console.error(`Model ${modelName} thất bại:`, error.message);
    }
  }

  throw new Error('Tất cả các model đều không thể phản hồi.');
}

function buildAnalysisPrompt(userNumber, isWinning, details) {
  return `
Bạn là "MÁY PHÂN TÍCH XỔ SỐ RETRO" — một cỗ máy phong cách Pixel Art thập niên 80.
Nhiệm vụ: tự thiết kế và trả về MỘT đoạn HTML hoàn chỉnh (kèm CSS inline do chính bạn viết) để phân tích dãy số của người dùng.

DỮ LIỆU:
- Số của người dùng: ${userNumber}
- Trạng thái: ${isWinning ? 'TRÚNG THƯỞNG' : 'KHÔNG TRÚNG'}
- Chi tiết: ${details || 'Không có'}

PHONG CÁCH PIXEL ART BẮT BUỘC (tự áp dụng vào CSS inline bạn viết):
- Viền cứng: border 3–4px solid #000, KHÔNG border-radius (giữ góc vuông).
- Đổ bóng khối kiểu 8-bit: box-shadow dạng offset cứng, không blur (ví dụ 6px 6px 0px #000), KHÔNG dùng box-shadow có blur-radius mờ.
- Font: 'Courier New', Courier, monospace (font chữ vuông, đơn cách).
- Màu sắc: bảng màu phẳng, tương phản cao, kiểu game console cũ (đen #000, trắng #fff, xanh lá neon #00ff00, cam #ff8c00, xám #e0e0e0...), KHÔNG dùng gradient hay màu pastel.
- Tiêu đề viết HOA, letter-spacing rộng, có thể thêm ký hiệu retro như &gt;&gt;, ★, ▓ để trang trí.
- Toàn bộ style phải là inline (style="..."), không dùng thẻ <style> hay class ngoài (trừ class gốc "ai-content-inner").

NỘI DUNG CẦN CÓ (tự viết HTML + câu chữ, không có mẫu sẵn để điền vào):
1. Tiêu đề khối phân tích.
2. Hiển thị lại số vé (${userNumber}) và trạng thái (${isWinning ? 'TRÚNG THƯỞNG' : 'KHÔNG TRÚNG'}).
3. Một đoạn "phân tích phong thủy" vui về ý nghĩa các con số trong dãy ${userNumber} (2–3 câu, mang tính giải trí, không mê tín nghiêm túc).
4. Một đoạn "lời khuyên tài chính" nhẹ nhàng, nhắc chơi xổ số có trách nhiệm (2–3 câu).
5. Nếu trạng thái là TRÚNG THƯỞNG: thêm khối "hướng dẫn nhận giải" nổi bật (nền màu neon, viền đậm) liệt kê các bước: kiểm tra vé còn nguyên vẹn; liên hệ công ty xổ số kiến thiết tại địa phương phát hành vé; mang theo CCCD/CMND; lĩnh thưởng trong vòng 30 ngày kể từ ngày quay số.

QUY TẮC OUTPUT:
1. CHỈ trả về HTML, không kèm giải thích, không dùng dấu \`\`\`.
2. Toàn bộ nội dung nằm trong một thẻ <div class="ai-content-inner" style="...">...</div> duy nhất.
3. Giọng văn vui, hợp chủ đề game thùng thập niên 80.
`;
}

async function analyzeTicket(userNumber, isWinning, details) {
  if (!TICKET_NUMBER_REGEX.test(userNumber)) {
    const err = new Error('Số vé không hợp lệ.');
    err.statusCode = 400;
    throw err;
  }

  const prompt = buildAnalysisPrompt(userNumber, isWinning, details);
  const text = await getResponseFromModel(prompt);
  return text.replace(/```html|```/g, '').trim();
}

module.exports = {
  TICKET_NUMBER_REGEX,
  refreshModelList,
  getResponseFromModel,
  buildAnalysisPrompt,
  analyzeTicket
};
