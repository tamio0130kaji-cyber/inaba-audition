require('dotenv').config();
const express = require('express');
const path = require('path');
const { capturePage } = require('./lib/capture');
const { analyzeCapture } = require('./lib/analyze');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.post('/api/analyze', async (req, res) => {
  const { url, goal } = req.body || {};

  if (!url || typeof url !== 'string') {
    return res.status(400).json({ error: 'urlは必須です。' });
  }
  if (!goal || typeof goal !== 'string') {
    return res.status(400).json({ error: 'goal（分析の目的）は必須です。' });
  }

  let parsedUrl;
  try {
    parsedUrl = new URL(url);
    if (!['http:', 'https:'].includes(parsedUrl.protocol)) throw new Error('invalid protocol');
  } catch {
    return res.status(400).json({ error: 'urlの形式が正しくありません。' });
  }

  try {
    const capture = await capturePage(parsedUrl.toString());
    const report = await analyzeCapture({ url: parsedUrl.toString(), goal, capture });
    res.json({
      report,
      preview: {
        aboveFoldScreenshot: capture.desktop.aboveFoldScreenshotBase64,
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message || '分析中にエラーが発生しました。' });
  }
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`LP Analyzer listening on http://localhost:${port}`);
});
