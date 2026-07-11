# LP改善分析ツール

LP/Webページの改善点をMECEなフレームワークで診断するWebアプリです。URLと目的（ゴール）を入力すると、対象ページを実際にヘッドレスブラウザで描画してスクリーンショットと構造化データを取得し、Claudeがそれらを分析して具体的な改善提案をレポートします。

## 診断フレーム

- **LIFTモデル（7軸）**：Value Proposition / Relevance / Clarity / Anxiety / Distraction / Urgency / Technical・UX
- **チャルディーニ「影響力の武器」**：返報性・一貫性・社会的証明・権威・好意・希少性・一体性
- **認知バイアス（行動経済学）**：アンカリング、損失回避、フレーミング効果、おとり効果、保有効果、現状維持バイアス

`lib/framework.js` にこれらの定義がある。ジェリー・オブライエン著『「買う理由」の作り方』の17のアイデアは、目次内容を確認でき次第 `OBRIEN_17_IDEAS` に追記する想定（現状は未反映）。

各問題点は「issue（問題点）」「why_it_matters（なぜ目的達成を妨げるか）」「fix（具体的な改善案）」の3点セットで出力される。

## セットアップ

```bash
cd lp-analyzer
npm install
npx playwright install chromium   # 初回のみ（ブラウザバイナリの取得）
cp .env.example .env
# .env にご自身のAnthropic APIキーを設定
npm start
```

ブラウザで `http://localhost:3000` を開き、URLと目的を入力して「診断する」を押す。

## 仕組み

1. `lib/capture.js`：Playwrightで対象URLをPC/モバイル両方の画面サイズで実描画し、ファーストビュー/全体のスクリーンショットと構造化データ（見出し・CTA文言・フォーム項目数・画像alt充足率・表示速度など）を取得
2. `lib/framework.js`：診断フレーム（LIFT / 影響力の武器 / 認知バイアス）をプロンプトとして構築
3. `lib/analyze.js`：スクリーンショットと構造化データ、ユーザー指定の目的をClaude（Vision対応）に渡し、構造化JSONレポートを取得
4. `public/`：URL入力フォームと、軸ごとの診断結果・優先度付き改善アクションを表示するUI

## 注意事項

- Anthropic APIの利用料金が発生する
- 対象ページの利用規約・robots.txt等に反する形でのスクレイピングは行わないこと
- ログイン必須ページや動的な個人情報を含むページの分析には対応していない
