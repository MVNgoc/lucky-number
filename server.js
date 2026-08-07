const express = require('express');
const cors = require('cors');

require('dotenv').config();

const { fetchKqxsHtml } = require('./lib/kqxsService');
const {
  fetchDaiListForWeekday,
  weekdayFromDateParam
} = require('./lib/daiService');
const { analyzeTicket, refreshModelList } = require('./lib/aiService');
const { readTicket } = require('./lib/ticketReader');

const app = express();
app.use(cors());
// Ảnh vé gửi lên dạng base64 nên vượt xa mức 100kb mặc định của express.json
app.use(express.json({ limit: '8mb' }));
app.use(express.static(__dirname));

app.get('/api/dai', async (req, res) => {
  const weekday = weekdayFromDateParam(req.query.date);
  res.json(await fetchDaiListForWeekday(weekday));
});

app.get('/api/kqxs', async (req, res) => {
  const { date, province } = req.query;
  try {
    const html = await fetchKqxsHtml(date, province);
    res.send(html);
  } catch (error) {
    res.status(error.statusCode || 500).send(error.message);
  }
});

app.post('/api/doc-ve', async (req, res) => {
  try {
    const { image, mimeType } = req.body;
    res.json(await readTicket(image, mimeType));
  } catch (e) {
    console.error('Lỗi đọc vé:', e);
    res
      .status(e.statusCode || 500)
      .json({ error: e.statusCode ? e.message : 'Không đọc được ảnh vé.' });
  }
});

app.post('/api/phan-tich-ai', async (req, res) => {
  try {
    const { userNumber, isWinning, details } = req.body;
    const aiText = await analyzeTicket(userNumber, isWinning, details);
    res.json({ aiText });
  } catch (e) {
    console.error('Lỗi cuối cùng:', e);
    res
      .status(e.statusCode || 500)
      .json({ error: e.statusCode ? e.message : 'Không thể phân tích AI vào lúc này.' });
  }
});

app.listen(3000, async () => {
  console.log('✅ Server online port 3000');
  await refreshModelList();
});
