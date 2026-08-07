const axios = require('axios');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const TICKET_NUMBER_REGEX = /^\d{5,6}$/;

// Model ID phải đúng định dạng, không phải tên hiển thị ("Gemini 3.5 Flash"):
// tên sai làm mọi lần gọi tốn thêm một request 400 trước khi rơi xuống fallback.
const FALLBACK_MODELS = [
  'gemini-flash-lite-latest',
  'gemini-3.1-flash-lite',
  'gemini-2.5-flash-lite',
  'gemini-2.5-flash',
  'gemini-2.0-flash'
];

// Mỗi tính năng ưu tiên model khác nhau vì đặc tính khác nhau:
// - Đọc ảnh vé: output ngắn, cần đọc số chính xác -> model mạnh, đo được ~3s.
// - Sinh HTML phân tích: output dài, model mạnh mất 14-18s (vượt trần 10s của
//   Netlify) còn model lite chỉ ~5s mà chất lượng vẫn đủ dùng.
const VISION_MODELS = ['gemini-3.5-flash', 'gemini-flash-latest'];
// Thứ tự theo đo thực tế với đúng prompt hiện tại. Đã loại
// gemini-3.1-flash-lite khỏi nhóm ưu tiên: nó vẽ đủ khối nhưng bỏ dấu tiếng
// Việt 3/3 lần khi prompt dài như bây giờ.
const ANALYSIS_MODELS = ['gemini-flash-lite-latest', 'gemini-2.5-flash-lite'];

// refreshModelList() nạp vào availableModels mấy chục model. Khi API lỗi thật
// (hết quota chẳng hạn) mà thử hết thì request kéo dài hàng chục giây và bị
// Netlify kill; thà báo lỗi sớm cho người dùng biết.
const MAX_MODEL_ATTEMPTS = 4;

// Độ trễ Gemini dao động mạnh: cùng một ảnh vé đo được 3s, 7s, có lần 25s.
// Netlify kill function ở 10s nên phải tự bỏ cuộc trước, để còn kịp thử model
// khác hoặc trả lỗi rõ ràng thay vì để người dùng nhận 502 không hiểu vì sao.
const MODEL_REQUEST_TIMEOUT_MS = 8000;

let availableModels = [...new Set(FALLBACK_MODELS)];

function getGenAI() {
  return new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
}

async function refreshModelList() {
  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${process.env.GEMINI_API_KEY}`;
    const response = await axios.get(url);
    const fetchedModels = response.data.models
      .filter(m => m.supportedGenerationMethods.includes('generateContent'))
      .map(m => m.name.replace('models/', ''));

    const uniqueFetchedModels = [...new Set(fetchedModels)];
    const prioritized = [...new Set(FALLBACK_MODELS)].filter(m =>
      uniqueFetchedModels.includes(m)
    );
    const rest = uniqueFetchedModels.filter(m => !prioritized.includes(m));
    availableModels = [...prioritized, ...rest];
    console.log('✅ Đã cập nhật danh sách model:', availableModels);
  } catch (err) {
    console.error('❌ Không thể lấy danh sách model, dùng danh sách dự phòng.');
  }
}

const VIETNAMESE_DIACRITICS_REGEX =
  /[À-ÃÈ-ÊÌÍÒ-ÕÙÚÝà-ãè-êìíò-õùúýĂăĐđĨĩŨũƠ-ưẠ-ỹ]/g;

// Model từng trả về tiếng Việt không dấu ("PHAN TICH CHUYEN SAU") — hiện ra thì
// người dùng thấy ngay là chữ lỗi. Bài phân tích luôn dài vài đoạn nên nếu đếm
// được quá ít ký tự có dấu thì chắc chắn model đã bỏ dấu, cho thử model khác.
const MIN_DIACRITICS = 10;

// Prompt yêu cầu ít nhất 4 khối, model đạt yêu cầu đo được 5-8 lần mỗi thuộc
// tính. Đặt ngưỡng 3 để không chặn oan bản dựng gọn hơn bình thường.
const MIN_STYLE_OCCURRENCES = 3;

// Trả null nếu hợp lệ, ngược lại trả lý do để log biết chặn vì điều kiện nào
function findHtmlResponseProblem(text) {
  const cleaned = text.replace(/```html|```/g, '').trim();
  if (!cleaned.startsWith('<')) return 'không bắt đầu bằng "<"';
  if (!cleaned.includes('class="ai-content-inner"')) {
    return 'thiếu class="ai-content-inner"';
  }

  const diacritics = cleaned.match(VIETNAMESE_DIACRITICS_REGEX) || [];
  if (diacritics.length < MIN_DIACRITICS) {
    return `tiếng Việt không dấu (chỉ ${diacritics.length} ký tự có dấu)`;
  }

  // Có model trả HTML gần như trơn -> hiện ra là mảng trắng đơn điệu, mất hẳn
  // phong cách pixel art. Đếm 3 dấu hiệu bắt buộc của style retro.
  const counts = {
    background: (cleaned.match(/background/g) || []).length,
    'border:': (cleaned.match(/border\s*:/g) || []).length,
    'box-shadow': (cleaned.match(/box-shadow/g) || []).length
  };
  const thieu = Object.entries(counts)
    .filter(([, count]) => count < MIN_STYLE_OCCURRENCES)
    .map(([name, count]) => `${name}=${count}`);
  if (thieu.length > 0) {
    return `style quá trơn, mất phong cách pixel art (${thieu.join(', ')})`;
  }

  return null;
}

function isValidHtmlResponse(text) {
  return findHtmlResponseProblem(text) === null;
}

// `request` là string prompt, hoặc mảng part (để kèm ảnh qua inlineData).
// `isValid` cho phép mỗi tính năng tự kiểm định dạng output nó cần.
// `preferred` là các model thử trước, phần còn lại dùng làm dự phòng.
async function getResponseFromModel(
  request,
  isValid = isValidHtmlResponse,
  preferred = ANALYSIS_MODELS,
  describeProblem = findHtmlResponseProblem
) {
  const genAI = getGenAI();
  const modelsToTry = [...new Set([...preferred, ...availableModels])].slice(
    0,
    MAX_MODEL_ATTEMPTS
  );
  for (const modelName of modelsToTry) {
    try {
      console.log(`Đang thử model: ${modelName}...`);
      const model = genAI.getGenerativeModel(
        { model: modelName },
        { timeout: MODEL_REQUEST_TIMEOUT_MS }
      );
      const result = await model.generateContent(request);
      const text = result.response.text();

      const problem = describeProblem ? describeProblem(text) : null;
      if (!isValid(text)) {
        console.error(
          `Model ${modelName} trả về output sai định dạng${problem ? ': ' + problem : ''}.`
        );
        continue;
      }

      return text;
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
- Font: 'Courier New', Courier, monospace (font chữ vuông, đơn cách).
- Màu sắc: bảng màu phẳng, tương phản cao, kiểu game console cũ (đen #000, trắng #fff, xanh lá neon #00ff00, cam #ff8c00, xám #e0e0e0...), KHÔNG dùng gradient hay màu pastel.
- Tiêu đề viết HOA, letter-spacing rộng.

CẤU TRÚC BẮT BUỘC — output PHẢI có ít nhất 4 khối lồng bên trong
<div class="ai-content-inner">, mỗi khối là một <div> riêng và MỖI khối đó
BẮT BUỘC có đủ 3 thứ trong style inline của nó:
  (a) background màu đặc (không để trống, không dùng màu trắng cho mọi khối —
      phải khác nhau giữa các khối để phân tách thị giác),
  (b) border: 3px solid #000 hoặc 4px solid #000, KHÔNG border-radius,
  (c) box-shadow offset cứng không blur, ví dụ box-shadow:6px 6px 0px #000
      (TUYỆT ĐỐI không dùng box-shadow có blur-radius mờ).
Tức là trong toàn bộ output phải đếm được ít nhất 4 lần "background", 4 lần
"border:" và 4 lần "box-shadow". Khối tiêu đề phải có nền màu nổi (cam #ff8c00
hoặc xanh neon #00ff00) với chữ đen. Một khối chỉ có chữ trên nền trắng, không
viền, không đổ bóng là SAI YÊU CẦU.
- KHÔNG dùng emoji, KHÔNG dùng ký hiệu hình khối để trang trí (★ ▓ ► ● ◆ ■ ※ và
  các ký hiệu tương tự), KHÔNG dùng dãy dấu lớn hơn/nhỏ hơn kiểu &gt;&gt;.
  Điều này CHỈ nói về ký hiệu trang trí, không liên quan đến chữ viết.
- Toàn bộ style phải là inline (style="..."), không dùng thẻ <style> hay class ngoài (trừ class gốc "ai-content-inner").
- Thẻ <div class="ai-content-inner"> BẮT BUỘC dùng width:100% và box-sizing:border-box, KHÔNG đặt width cố định theo px, KHÔNG dùng margin:auto để căn giữa — khối phải lấp đầy toàn bộ chiều ngang của khung chứa nó.

NỘI DUNG CẦN CÓ (tự viết HTML + câu chữ, không có mẫu sẵn để điền vào):
1. Một tiêu đề DUY NHẤT cho khối phân tích (ví dụ "PHÂN TÍCH CHUYÊN SÂU"). KHÔNG đặt tên máy/phiên bản (không viết dạng "MÁY PHÂN TÍCH RETRO vX.XX"), KHÔNG thêm dòng phụ đề/tagline hệ thống bên dưới tiêu đề.
2. Hiển thị lại số vé (${userNumber}) và trạng thái (${isWinning ? 'TRÚNG THƯỞNG' : 'KHÔNG TRÚNG'}).
3. Một đoạn "phân tích phong thủy" vui về ý nghĩa các con số trong dãy ${userNumber} (2–3 câu, mang tính giải trí, không mê tín nghiêm túc).
4. Một đoạn "lời khuyên tài chính" nhẹ nhàng, nhắc chơi xổ số có trách nhiệm (2–3 câu).
5. Nếu trạng thái là TRÚNG THƯỞNG: thêm khối "hướng dẫn nhận giải" nổi bật (nền màu neon, viền đậm) liệt kê các bước: kiểm tra vé còn nguyên vẹn; liên hệ công ty xổ số kiến thiết tại địa phương phát hành vé; mang theo CCCD/CMND; lĩnh thưởng trong vòng 30 ngày kể từ ngày quay số.
6. KHÔNG thêm bất kỳ dòng chân trang/credit nào kiểu máy game thùng ở cuối (ví dụ "INSERT COIN TO...", "POWERED BY...", tên máy, số phiên bản). Kết thúc HTML ngay sau nội dung phân tích ở mục 3–5.

QUY TẮC OUTPUT (BẮT BUỘC):
1. Output PHẢI bắt đầu ngay bằng ký tự "<" — không thêm bất kỳ lời dẫn, mô tả, hay tóm tắt yêu cầu nào trước đó.
2. CHỈ trả về HTML, không kèm giải thích, không dùng dấu \`\`\`, không dùng gạch đầu dòng markdown (*, -).
3. Toàn bộ nội dung nằm trong một thẻ <div class="ai-content-inner" style="...">...</div> duy nhất.
4. Giọng văn vui, hợp chủ đề game thùng thập niên 80.
5. Viết tiếng Việt chuẩn chính tả, CÓ DẤU ĐẦY ĐỦ ở mọi chữ, kể cả chữ VIẾT HOA
   (ví dụ đúng: "PHÂN TÍCH CHUYÊN SÂU", "TRÚNG THƯỞNG", "thịnh vượng"). Không
   lẫn chữ của ngôn ngữ khác.
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

const ALLOWED_IMAGE_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif'
];
// Client đã resize về ~1024px nên ảnh chỉ cỡ trăm KB. Trần này để chặn payload
// bất thường, đồng thời tránh vượt giới hạn body của Netlify function.
const MAX_IMAGE_BASE64_LENGTH = 4 * 1024 * 1024;

const TICKET_READ_PROMPT = `
Bạn đang xem ảnh một tờ vé số truyền thống Việt Nam. Hãy đọc 3 thông tin.

1. soVe: dãy số dò thưởng — là dãy chữ số IN CỠ LỚN NHẤT trên vé (5 hoặc 6
   chữ số). Chỉ lấy chữ số, bỏ mọi dấu cách. TUYỆT ĐỐI KHÔNG lấy: giá vé
   (10.000đ, 10000 đồng), số hiệu lô/kỳ vé (ví dụ K1, 8K1, S2-25), mã series,
   số điện thoại, hay bất kỳ số nào in nhỏ.
2. dai: tên tỉnh/thành của đài phát hành. Vé thường in tên công ty xổ số kiến
   thiết (ví dụ "XSKT LÂM ĐỒNG", "CÔNG TY XSKT TIỀN GIANG"). Trả về tên
   tỉnh/thành, không kèm chữ "xổ số", "XSKT" hay "công ty".
3. ngay: ngày mở thưởng in trên vé, định dạng DD/MM/YYYY.

QUY TẮC OUTPUT (BẮT BUỘC):
- CHỈ trả về một object JSON, không giải thích, không dùng dấu \`\`\`.
- Đúng dạng: {"soVe":"123456","dai":"Tiền Giang","ngay":"05/08/2026"}
- Trường nào không đọc được rõ ràng thì để null. KHÔNG được đoán, KHÔNG được
  bịa. Thà trả null còn hơn trả sai.
`;

function stripJsonFence(text) {
  return text.replace(/```json|```/g, '').trim();
}

function isValidTicketJson(text) {
  try {
    const parsed = JSON.parse(stripJsonFence(text));
    return (
      parsed !== null &&
      typeof parsed === 'object' &&
      !Array.isArray(parsed) &&
      'soVe' in parsed
    );
  } catch (err) {
    return false;
  }
}

// Chỉ nhận giá trị đọc được chắc chắn, sai định dạng thì coi như không đọc ra
function normalizeReadTicket(parsed) {
  const digits =
    typeof parsed.soVe === 'string' ? parsed.soVe.replace(/\D/g, '') : '';
  const soVe = TICKET_NUMBER_REGEX.test(digits) ? digits : null;

  const dai =
    typeof parsed.dai === 'string' && parsed.dai.trim() ? parsed.dai.trim() : null;

  const ngayMatch =
    typeof parsed.ngay === 'string'
      ? parsed.ngay.match(/^(\d{2})\/(\d{2})\/(\d{4})$/)
      : null;
  let ngay = null;
  if (ngayMatch) {
    const [, day, month, year] = ngayMatch.map(Number);
    const parsedDate = new Date(year, month - 1, day);
    const isRealDate =
      parsedDate.getFullYear() === year &&
      parsedDate.getMonth() === month - 1 &&
      parsedDate.getDate() === day;
    if (isRealDate) ngay = ngayMatch[0];
  }

  return { soVe, dai, ngay };
}

async function readTicketImage(imageBase64, mimeType) {
  if (typeof imageBase64 !== 'string' || !imageBase64) {
    const err = new Error('Thiếu ảnh vé.');
    err.statusCode = 400;
    throw err;
  }

  if (!ALLOWED_IMAGE_TYPES.includes(mimeType)) {
    const err = new Error('Định dạng ảnh không được hỗ trợ.');
    err.statusCode = 400;
    throw err;
  }

  if (imageBase64.length > MAX_IMAGE_BASE64_LENGTH) {
    const err = new Error('Ảnh quá lớn, vui lòng thử lại.');
    err.statusCode = 413;
    throw err;
  }

  const text = await getResponseFromModel(
    [TICKET_READ_PROMPT, { inlineData: { data: imageBase64, mimeType } }],
    isValidTicketJson,
    VISION_MODELS,
    // Kiểm HTML không áp cho nhánh này, truyền null để log không báo lý do sai
    null
  );

  return normalizeReadTicket(JSON.parse(stripJsonFence(text)));
}

module.exports = {
  TICKET_NUMBER_REGEX,
  isValidHtmlResponse,
  ALLOWED_IMAGE_TYPES,
  isValidTicketJson,
  normalizeReadTicket,
  readTicketImage,
  refreshModelList,
  getResponseFromModel,
  buildAnalysisPrompt,
  analyzeTicket
};
