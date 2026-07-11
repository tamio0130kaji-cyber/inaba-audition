const Anthropic = require('@anthropic-ai/sdk');
const { buildSystemPrompt } = require('./framework');

function client() {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY が設定されていません。.envを確認してください。');
  }
  return new Anthropic({ apiKey });
}

function extractJson(text) {
  const trimmed = text.trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    const start = trimmed.indexOf('{');
    const end = trimmed.lastIndexOf('}');
    if (start !== -1 && end !== -1 && end > start) {
      return JSON.parse(trimmed.slice(start, end + 1));
    }
    throw new Error('Claudeの応答をJSONとして解析できませんでした。');
  }
}

async function analyzeCapture({ url, goal, capture }) {
  const anthropic = client();
  const model = process.env.ANTHROPIC_MODEL || 'claude-sonnet-5';

  const structuredData = {
    url,
    goal,
    desktop: {
      status: capture.desktop.status,
      loadMs: capture.desktop.loadMs,
      viewport: capture.desktop.viewport,
      signals: capture.desktop.signals,
    },
    mobile: {
      status: capture.mobile.status,
      loadMs: capture.mobile.loadMs,
      viewport: capture.mobile.viewport,
      signals: capture.mobile.signals,
    },
  };

  const content = [
    {
      type: 'text',
      text: `# 診断対象\nURL: ${url}\nユーザーが指定した目的（ゴール）: ${goal}\n\n# 構造化データ（PC/モバイル）\n${JSON.stringify(structuredData, null, 2)}\n\n# 画像\n1枚目: PCのファーストビュー\n2枚目: PCの全体スクリーンショット\n3枚目: モバイルの全体スクリーンショット\n\n上記の情報をもとに、指定のJSONスキーマで診断結果のみを出力してください。`,
    },
    { type: 'image', source: { type: 'base64', media_type: 'image/png', data: capture.desktop.aboveFoldScreenshotBase64 } },
    { type: 'image', source: { type: 'base64', media_type: 'image/png', data: capture.desktop.fullPageScreenshotBase64 } },
    { type: 'image', source: { type: 'base64', media_type: 'image/png', data: capture.mobile.fullPageScreenshotBase64 } },
  ];

  const response = await anthropic.messages.create({
    model,
    max_tokens: 4096,
    system: buildSystemPrompt(),
    messages: [{ role: 'user', content }],
  });

  const textBlock = response.content.find((b) => b.type === 'text');
  if (!textBlock) {
    throw new Error('Claudeからテキスト応答が得られませんでした。');
  }

  return extractJson(textBlock.text);
}

module.exports = { analyzeCapture };
