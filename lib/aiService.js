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
Nhiệm vụ: phân tích dãy số của người dùng và trả về MỘT đoạn HTML sạch (chỉ HTML, dùng CSS inline).

DỮ LIỆU:
- Số của người dùng: ${userNumber}
- Trạng thái: ${isWinning ? 'TRÚNG THƯỞNG' : 'KHÔNG TRÚNG'}
- Chi tiết: ${details || 'Không có'}

QUY TẮC OUTPUT:
1. CHỈ trả về HTML, không kèm giải thích, không dùng dấu \`\`\`.
2. Điền nội dung vào đúng các chỗ đánh dấu [AI: ...]. Mỗi mục viết 2–3 câu, giọng vui, hợp chủ đề retro.
3. Giữ nguyên cấu trúc thẻ và style inline bên dưới, không thêm/bớt thẻ ngoài khung.

CẤU TRÚC HTML CẦN TRẢ VỀ:
<div class="ai-content-inner" style="font-family:'Courier New', monospace; background:#fff; border:4px solid #000; box-shadow:8px 8px 0px rgba(0,0,0,0.2); padding:16px;">
  <h3 style="color:#000; text-transform:uppercase; letter-spacing:2px; border-bottom:4px solid #000; padding-bottom:8px; margin-top:0;">&gt;&gt; PHÂN TÍCH CHUYÊN SÂU</h3>
  <p><strong>SỐ CỦA BẠN:</strong> ${userNumber}</p>
  <p><strong>KẾT QUẢ:</strong> ${
    isWinning ? 'CHÚC MỪNG BẠN ĐÃ TRÚNG THƯỞNG!' : 'TIẾP TỤC MAY MẮN LẦN SAU.'
  }</p>

  <div style="background:#e0e0e0; border:3px solid #000; padding:10px; margin:15px 0;">
    <h4 style="color:#000; text-transform:uppercase; margin-top:0;">✨ PHÂN TÍCH PHONG THỦY</h4>
    <p>[AI: viết vài dòng về ý nghĩa các con số trong dãy ${userNumber}, mang tính giải trí]</p>
    <h4 style="color:#000; text-transform:uppercase;">💡 LỜI KHUYÊN TÀI CHÍNH</h4>
    <p>[AI: một lời khuyên tài chính chung, nhẹ nhàng, nhắc chơi xổ số có trách nhiệm]</p>
  </div>
  ${
    isWinning
      ? `
  <div style="border:4px solid #000; padding:15px; background:#00ff00; box-shadow:6px 6px 0px #000;">
    <h4 style="color:#000; text-transform:uppercase; margin-top:0;">🎁 HƯỚNG DẪN NHẬN GIẢI</h4>
    <p>Xin chúc mừng! Để nhận giải, bạn cần:</p>
    <ul style="padding-left:20px;">
      <li>Kiểm tra vé còn nguyên vẹn, không rách hay tẩy xóa.</li>
      <li>Liên hệ công ty Xổ số kiến thiết tại địa phương phát hành vé.</li>
      <li>Mang theo CCCD/CMND khi đến làm thủ tục.</li>
      <li>Lĩnh thưởng trong vòng 30 ngày kể từ ngày quay số.</li>
    </ul>
  </div>`
      : ''
  }
</div>
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
