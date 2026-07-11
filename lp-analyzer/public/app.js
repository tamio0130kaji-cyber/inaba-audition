const form = document.getElementById('analyzeForm');
const submitBtn = document.getElementById('submitBtn');
const errorMsg = document.getElementById('errorMsg');
const resultEl = document.getElementById('result');

const PRIORITY_LABEL = { high: '優先度：高', medium: '優先度：中', low: '優先度：低' };

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  errorMsg.style.display = 'none';
  resultEl.hidden = true;
  resultEl.innerHTML = '';

  const url = document.getElementById('url').value.trim();
  const goal = document.getElementById('goal').value.trim();

  submitBtn.disabled = true;
  submitBtn.textContent = '診断中…（数十秒かかります）';
  resultEl.hidden = false;
  resultEl.innerHTML = '<div class="loading">ページを描画してスクリーンショットを取得し、AIが分析しています…</div>';

  try {
    const res = await fetch('/api/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url, goal }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || '分析に失敗しました。');
    renderReport(data.report, data.preview);
  } catch (err) {
    resultEl.hidden = true;
    errorMsg.textContent = err.message;
    errorMsg.style.display = 'block';
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = '診断する';
  }
});

function renderReport(report, preview) {
  const priorities = (report.topPriorities || [])
    .sort((a, b) => (a.rank || 0) - (b.rank || 0))
    .map((p) => `<li><strong>${escapeHtml(p.axis || '')}</strong>：${escapeHtml(p.action || '')}<br><span style="opacity:.7">期待される効果：${escapeHtml(p.expected_impact || '')}</span></li>`)
    .join('');

  const axesHtml = (report.axes || []).map(renderAxis).join('');

  resultEl.innerHTML = `
    <div class="summary-card">
      <div class="score-label">総合スコア</div>
      <div class="score">${escapeHtml(String(report.overallScore ?? '-'))}<span style="font-size:16px;opacity:.6"> / 100</span></div>
      <p>${escapeHtml(report.summary || '')}</p>
      ${priorities ? `<ol class="priorities">${priorities}</ol>` : ''}
      ${preview?.aboveFoldScreenshot ? `<img class="screenshot-preview" src="data:image/png;base64,${preview.aboveFoldScreenshot}" alt="ファーストビューのスクリーンショット">` : ''}
    </div>
    ${axesHtml}
  `;
}

function renderAxis(axis) {
  const findings = (axis.findings || []).map((f) => `
    <div class="finding">
      <span class="priority ${escapeHtml(f.priority || 'low')}">${escapeHtml(PRIORITY_LABEL[f.priority] || f.priority || '')}</span>
      <dl>
        <dt>問題点</dt><dd>${escapeHtml(f.issue || '')}</dd>
        <dt>なぜ目的達成を妨げるか</dt><dd>${escapeHtml(f.why_it_matters || '')}</dd>
        <dt>改善案</dt><dd>${escapeHtml(f.fix || '')}</dd>
      </dl>
      ${(f.principle_refs || []).length ? `<div class="refs">関連原理：${f.principle_refs.map(escapeHtml).join(' / ')}</div>` : ''}
    </div>
  `).join('') || '<p style="opacity:.6;font-size:14px;">この軸で目立った問題点は見つかりませんでした。</p>';

  return `
    <div class="axis-card">
      <div class="axis-head">
        <h3>${escapeHtml(axis.label || axis.axis || '')}</h3>
        <span class="axis-score">スコア ${escapeHtml(String(axis.score ?? '-'))} / 10</span>
      </div>
      ${findings}
    </div>
  `;
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
