const { chromium } = require('playwright');

const CTA_WORDS = [
  '申し込', '申込', '購入', '登録', 'カートに入れる', '資料請求', '問い合わせ', 'お問い合わせ',
  '無料', 'ダウンロード', '予約', '応募', '今すぐ', 'クリック', 'buy', 'order', 'sign up', 'subscribe',
  'download', 'contact', 'request', 'apply', 'get started', 'add to cart', 'checkout'
];

async function capturePage(url) {
  const browser = await chromium.launch();
  try {
    const desktop = await analyzeViewport(browser, url, { width: 1440, height: 900 }, true);
    const mobile = await analyzeViewport(browser, url, { width: 390, height: 844 }, false);

    return {
      url,
      desktop,
      mobile,
    };
  } finally {
    await browser.close();
  }
}

async function analyzeViewport(browser, url, viewport, captureAboveFold) {
  const context = await browser.newContext({ viewport });
  const page = await context.newPage();

  const start = Date.now();
  const response = await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
  const loadMs = Date.now() - start;
  const status = response ? response.status() : null;

  let aboveFoldShot = null;
  if (captureAboveFold) {
    aboveFoldShot = (await page.screenshot()).toString('base64');
  }
  const fullPageShot = (await page.screenshot({ fullPage: true })).toString('base64');

  const signals = await page.evaluate((ctaWords) => {
    const text = document.body.innerText || '';
    const wordCount = text.trim().split(/\s+/).filter(Boolean).length;

    const h1 = document.querySelector('h1');
    const title = document.title || '';
    const metaDescription = document.querySelector('meta[name="description"]')?.content || '';
    const viewportMeta = document.querySelector('meta[name="viewport"]')?.content || null;

    const images = Array.from(document.querySelectorAll('img'));
    const imagesMissingAlt = images.filter((img) => !img.getAttribute('alt')).length;

    const forms = Array.from(document.querySelectorAll('form'));
    const formFieldCounts = forms.map((f) => f.querySelectorAll('input,select,textarea').length);

    const clickable = Array.from(document.querySelectorAll('a,button,input[type=submit],input[type=button]'));
    const ctaMatches = clickable
      .map((el) => (el.innerText || el.value || '').trim())
      .filter((t) => t && ctaWords.some((w) => t.toLowerCase().includes(w.toLowerCase())));

    const outboundLinks = Array.from(document.querySelectorAll('a[href]')).filter((a) => {
      try {
        return new URL(a.href, location.href).origin !== location.origin;
      } catch {
        return false;
      }
    }).length;

    const scriptCount = document.querySelectorAll('script[src]').length;

    return {
      title,
      metaDescription,
      headline: h1 ? h1.innerText.trim() : null,
      viewportMetaPresent: Boolean(viewportMeta),
      wordCount,
      imageCount: images.length,
      imagesMissingAlt,
      formCount: forms.length,
      formFieldCounts,
      ctaCount: ctaMatches.length,
      ctaSamples: [...new Set(ctaMatches)].slice(0, 10),
      outboundLinkCount: outboundLinks,
      externalScriptCount: scriptCount,
    };
  }, CTA_WORDS);

  await context.close();

  return {
    viewport,
    status,
    loadMs,
    aboveFoldScreenshotBase64: aboveFoldShot,
    fullPageScreenshotBase64: fullPageShot,
    signals,
  };
}

module.exports = { capturePage };
