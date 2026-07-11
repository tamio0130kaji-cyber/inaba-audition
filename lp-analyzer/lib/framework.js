// LP/Webページを「なぜ成果が出ていないか」でMECEに分解するための診断フレーム定義。
// 各配列はプロンプト生成時にそのままLLMへ渡す。ここを編集すれば診断の観点を追加/修正できる。

const LIFT_AXES = [
  {
    id: 'value_proposition',
    label: 'Value Proposition（価値提案）',
    question: 'そもそも提供している価値は、ターゲットにとって魅力的で差別化されているか',
  },
  {
    id: 'relevance',
    label: 'Relevance（訴求の一致）',
    question: '想定される流入経路（広告・SNS・検索など）での期待とページの内容が一致しているか',
  },
  {
    id: 'clarity',
    label: 'Clarity（明瞭さ）',
    question: '誰に何を伝えたいページかが一瞬で伝わるか（コピー・視覚階層・情報設計）',
  },
  {
    id: 'anxiety',
    label: 'Anxiety（不安要素）',
    question: '申込/購入への不安材料（実績・保証・口コミ・運営者情報・セキュリティ表示など）は解消されているか',
  },
  {
    id: 'distraction',
    label: 'Distraction（気が散る要素）',
    question: '目的の行動（CTA）以外に注意を奪う要素はないか',
  },
  {
    id: 'urgency',
    label: 'Urgency（緊急性）',
    question: '「今すぐ動く理由」（期限・枠数・機会損失）が提示されているか',
  },
  {
    id: 'technical_ux',
    label: 'Technical/UX（実行品質）',
    question: '表示速度・モバイル最適化・フォームの入力コスト・CTAの視認性/タップしやすさなど技術面に問題はないか',
  },
];

const CIALDINI_PRINCIPLES = [
  { id: 'reciprocity', label: '返報性', hint: '先に価値を与えることで「お返し」したい心理を喚起できているか（無料診断・お役立ち資料など）' },
  { id: 'commitment_consistency', label: '一貫性', hint: '小さなYES（メール登録等）を積み重ね、大きな行動へ繋げる設計があるか' },
  { id: 'social_proof', label: '社会的証明', hint: '利用者数・口コミ・事例・メディア掲載など「他者も選んでいる」証拠があるか' },
  { id: 'authority', label: '権威', hint: '専門性・資格・受賞歴・監修者など信頼を裏付ける権威性が示されているか' },
  { id: 'liking', label: '好意', hint: '親近感・共感・ストーリーテリングにより発信者への好意が形成されているか' },
  { id: 'scarcity', label: '希少性', hint: '数量限定・期間限定・機会の希少性が正しく（誇張なく）伝わっているか' },
  { id: 'unity', label: '一体性', hint: '「私たちは同じ属性/コミュニティだ」という共同体意識を作れているか' },
];

const COGNITIVE_BIASES = [
  { id: 'anchoring', label: 'アンカリング効果', hint: '最初に提示する数字（元値・上位プラン等）が後続の判断の基準点になっているか' },
  { id: 'loss_aversion', label: '損失回避', hint: '「得る喜び」より「逃す痛み」の訴求（機会損失・現状維持のリスク）が使えているか' },
  { id: 'framing_effect', label: 'フレーミング効果', hint: '同じ事実でも伝え方（月額換算・割引率・残り時間など）で印象を強められているか' },
  { id: 'decoy_effect', label: 'おとり効果', hint: '複数プランの中に「本命プランを選ばせる」ための比較対象が設計されているか' },
  { id: 'endowment_effect', label: '保有効果', hint: '無料体験・返金保証などで「自分のもの」感覚を先に持たせられているか' },
  { id: 'status_quo_bias', label: '現状維持バイアス', hint: '行動しない方が楽だと感じさせる慣性を、どう突破する設計になっているか' },
];

// TODO: ジェリー・オブライエン著『「買う理由」の作り方 どうしても欲しいと思わせる17のアイデア』の
// 目次/17項目が確認でき次第、ここに追記する。現時点では未反映。
const OBRIEN_17_IDEAS = [];

function buildAxesPromptBlock() {
  return LIFT_AXES.map((a) => `- [${a.id}] ${a.label}: ${a.question}`).join('\n');
}

function buildPrinciplesPromptBlock() {
  return CIALDINI_PRINCIPLES.map((p) => `- [cialdini:${p.id}] ${p.label}: ${p.hint}`).join('\n');
}

function buildBiasesPromptBlock() {
  return COGNITIVE_BIASES.map((b) => `- [bias:${b.id}] ${b.label}: ${b.hint}`).join('\n');
}

function buildSystemPrompt() {
  const obrienBlock = OBRIEN_17_IDEAS.length
    ? `\n### 追加フレーム：ジェリー・オブライエン「買う理由」17のアイデア\n${OBRIEN_17_IDEAS.map((i) => `- [obrien:${i.id}] ${i.label}: ${i.hint}`).join('\n')}\n`
    : '';

  return `あなたはLP/Webページのコンバージョン改善を専門とするCRO（Conversion Rate Optimization）コンサルタントです。
与えられたページのスクリーンショット（PC/モバイル）と構造化データ、ユーザーが指定した目的（ゴール）をもとに、
以下のMECEな診断フレームに沿って、具体的かつロジカルに改善点を診断してください。

## 診断フレーム

### 1. LIFTモデル（7軸・MECE）
${buildAxesPromptBlock()}

### 2. チャルディーニ「影響力の武器」（説得原理・上記軸の根拠付けに使う）
${buildPrinciplesPromptBlock()}

### 3. 認知バイアス（行動経済学・上記軸の根拠付けに使う）
${buildBiasesPromptBlock()}
${obrienBlock}
## 出力ルール
- 必ず有効なJSONのみを出力すること（説明文やMarkdownのコードフェンスは付けない）。
- 各issueは「現状の問題点(issue)」「なぜ目的達成を妨げるか(why_it_matters)」「具体的な改善案(fix)」の3点セットで書くこと。単なる感想や一般論ではなく、スクリーンショット・構造化データから読み取れる具体的な根拠を示すこと。
- 各issueには関連する説得原理/バイアスがあれば principle_refs に ["cialdini:social_proof"] のような形式で入れる（なければ空配列）。
- priority は "high" | "medium" | "low"。ユーザーが指定した目的（ゴール）への影響度で判断すること。
- topPriorities には、axesの中から最重要な3〜5件を優先順位付きで要約すること。
- 良い点があれば無理に欠点を作らず、findingsが空の軸があってもよい。

## 出力JSONスキーマ
{
  "goal": string,
  "overallScore": number, // 0-100
  "summary": string, // 3〜5文程度の総評
  "axes": [
    {
      "axis": string, // 上記フレームのid
      "label": string,
      "score": number, // 0-10
      "findings": [
        {
          "issue": string,
          "why_it_matters": string,
          "fix": string,
          "priority": "high" | "medium" | "low",
          "principle_refs": string[]
        }
      ]
    }
  ],
  "topPriorities": [
    { "rank": number, "axis": string, "action": string, "expected_impact": string }
  ]
}`;
}

module.exports = {
  LIFT_AXES,
  CIALDINI_PRINCIPLES,
  COGNITIVE_BIASES,
  OBRIEN_17_IDEAS,
  buildSystemPrompt,
};
