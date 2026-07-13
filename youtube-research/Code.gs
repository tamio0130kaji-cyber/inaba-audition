/**
 * YouTube 参考チャンネル リサーチ＆スコアリング
 * =====================================================
 * スプレッドシートに貼り付けたチャンネルURL/IDを、YouTube Data API v3 で取得し
 * 「参考チャンネル要件定義」の5軸で自動採点して書き戻すツール。
 *
 * --- セットアップ手順 ---
 * 1. 採点用のGoogleスプレッドシートを作成
 * 2. 拡張機能 > Apps Script を開き、このファイルを貼り付けて保存
 * 3. Google Cloud Console で YouTube Data API v3 を有効化し、APIキーを発行
 * 4. Apps Script の「プロジェクトの設定 > スクリプト プロパティ」に
 *    キー: YOUTUBE_API_KEY / 値: 発行したAPIキー  を登録
 * 5. シートのA列1行目に「channel」と入力し、2行目以降に
 *    チャンネルURL（例: https://www.youtube.com/@xxxx）またはチャンネルIDを縦に貼る
 * 6. メニュー「YT リサーチ」>「全行を採点」を実行（初回は権限承認）
 */

const CRITERIA = {
  maxChannelAgeMonths: 12,
  maxDaysSinceUpload: 30,
  minSubsPerMonth: 1000,
  minViewSubRatio: 0.15,
  minEngagementRate: 0.03,
  minAvgComments: 10,
  maxSubsForReference: 1000000,
  recentVideoSample: 15
};

const OUTPUT_HEADERS = [
  "channel", "チャンネル名", "channelId",
  "開設日", "開設からの月数", "最終投稿日", "最終投稿からの日数",
  "登録者数", "動画本数", "総再生数",
  "平均再生数(直近)", "平均いいね(直近)", "平均コメント(直近)",
  "再生÷登録者", "エンゲージ率", "月あたり登録者(近似)",
  "軸1鮮度", "軸2初動※", "軸3エンゲージ", "軸4規模", "総合判定", "備考"
];

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu("YT リサーチ")
    .addItem("全行を採点", "scoreAllChannels")
    .addItem("自動リサーチ（設定シートのキーワードから）", "discoverChannels")
    .addItem("業界競合リサーチ", "researchCompetitors")
    .addToUi();
}

function researchCompetitors() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const cfg = ss.getSheetByName("設定");
  if (!cfg) { SpreadsheetApp.getUi().alert("「設定」シートを作成してください。"); return; }

  const keywords = String(cfg.getRange("B4").getValue()).split(",").map(s => s.trim()).filter(Boolean);
  const maxChannels = Number(cfg.getRange("B5").getValue()) || 10;
  if (!keywords.length) { SpreadsheetApp.getUi().alert("設定シートB4に業界キーワードを入れてください。"); return; }

  const seen = {};
  keywords.forEach(kw => {
    try {
      const res = ytApi_("search", {
        part: "snippet", type: "video", q: kw,
        order: "relevance", maxResults: 25, regionCode: "JP", relevanceLanguage: "ja"
      });
      (res.items || []).forEach(it => {
        const cid = it.snippet.channelId;
        if (cid) seen[cid] = (seen[cid] || 0) + 1;
      });
    } catch (err) { Logger.log("検索失敗(" + kw + "): " + err); }
    Utilities.sleep(200);
  });

  const channelIds = Object.keys(seen).sort((a, b) => seen[b] - seen[a]).slice(0, maxChannels);
  if (!channelIds.length) { SpreadsheetApp.getUi().alert("競合が見つかりませんでした。"); return; }

  const headers = ["チャンネル名","チャンネルURL","登録者数","動画本数","開設月数","投稿頻度(本/月)",
                   "TOP1動画","TOP1再生","TOP2動画","TOP2再生","TOP3動画","TOP3再生"];
  let out = ss.getSheetByName("業界競合結果");
  if (!out) out = ss.insertSheet("業界競合結果");
  out.clear();
  out.appendRow(["業界KW:" + keywords.join("・") + " / " + new Date().toLocaleString()]);
  out.appendRow(headers);

  channelIds.forEach(cid => {
    try {
      const ch = fetchChannel_(cid);
      const subs = Number(ch.statistics.subscriberCount || 0);
      const videoCount = Number(ch.statistics.videoCount || 0);
      const ageMonths = monthsBetween_(new Date(ch.snippet.publishedAt), new Date());
      const freq = ageMonths > 0 ? Math.round((videoCount / ageMonths) * 10) / 10 : videoCount;
      const top = getChannelTopVideos_(cid, 3);
      out.appendRow([
        ch.snippet.title, "https://www.youtube.com/channel/" + cid, subs, videoCount, ageMonths, freq,
        top[0] ? top[0].title : "-", top[0] ? top[0].views : "",
        top[1] ? top[1].title : "-", top[1] ? top[1].views : "",
        top[2] ? top[2].title : "-", top[2] ? top[2].views : ""
      ]);
    } catch (err) {
      out.appendRow(["取得失敗", "https://www.youtube.com/channel/" + cid, "", "", "", "", String(err), "", "", "", "", ""]);
    }
    Utilities.sleep(200);
  });

  out.setFrozenRows(2);
  out.autoResizeColumns(1, headers.length);
}

function getChannelTopVideos_(channelId, n) {
  const res = ytApi_("search", {
    part: "snippet", type: "video", channelId: channelId,
    order: "viewCount", maxResults: n
  });
  if (!res.items || !res.items.length) return [];
  const ids = res.items.map(i => i.id.videoId).filter(Boolean).join(",");
  if (!ids) return [];
  const vids = ytApi_("videos", { part: "snippet,statistics", id: ids });
  return (vids.items || []).map(v => ({
    title: v.snippet.title,
    views: Number(v.statistics.viewCount || 0)
  })).sort((a, b) => b.views - a.views);
}

function discoverChannels() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const cfg = ss.getSheetByName("設定");
  if (!cfg) { SpreadsheetApp.getUi().alert("「設定」シートを作成してください。"); return; }

  const purpose = String(cfg.getRange("B1").getValue()).trim() || "3";
  const keywords = String(cfg.getRange("B2").getValue()).split(",").map(s => s.trim()).filter(Boolean);
  const perKeyword = Number(cfg.getRange("B3").getValue()) || 10;
  if (!keywords.length) { SpreadsheetApp.getUi().alert("設定シートB2にキーワードを入れてください。"); return; }

  const publishedAfter = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString();

  const foundIds = {};
  keywords.forEach(kw => {
    try {
      const res = ytApi_("search", {
        part: "snippet", type: "video", q: kw,
        order: "viewCount", publishedAfter: publishedAfter,
        maxResults: Math.min(perKeyword, 50), regionCode: "JP", relevanceLanguage: "ja"
      });
      (res.items || []).forEach(it => { if (it.snippet.channelId) foundIds[it.snippet.channelId] = true; });
    } catch (err) { Logger.log("検索失敗(" + kw + "): " + err); }
    Utilities.sleep(200);
  });

  const channelIds = Object.keys(foundIds);
  if (!channelIds.length) { SpreadsheetApp.getUi().alert("候補が見つかりませんでした。"); return; }

  const rows = [];
  channelIds.forEach(cid => {
    try { rows.push(evaluateChannel_(cid)); } catch (err) {}
    Utilities.sleep(150);
  });

  const idx = { sub: 7, subPerMonth: 15, viewSub: 13, engage: 14, judge: 20 };
  rows.sort((a, b) => {
    const passA = String(a[idx.judge]).startsWith("◎") ? 1 : 0;
    const passB = String(b[idx.judge]).startsWith("◎") ? 1 : 0;
    if (passA !== passB) return passB - passA;
    const metric = (row) => {
      if (purpose === "1") return Number(row[idx.subPerMonth]) || 0;
      if (purpose === "2") return parseFloat(row[idx.engage]) || 0;
      return (Number(row[idx.subPerMonth]) || 0) / 1000 + (parseFloat(row[idx.engage]) || 0);
    };
    return metric(b) - metric(a);
  });

  let out = ss.getSheetByName("自動リサーチ結果");
  if (!out) out = ss.insertSheet("自動リサーチ結果");
  out.clear();
  out.appendRow(["目的:" + purpose + " / キーワード:" + keywords.join("・") + " / " + new Date().toLocaleString()]);
  out.appendRow(OUTPUT_HEADERS);
  rows.forEach(r => out.appendRow(r));
  out.setFrozenRows(2);
}

function getApiKey_() {
  const key = PropertiesService.getScriptProperties().getProperty("YOUTUBE_API_KEY");
  if (!key) throw new Error("スクリプトプロパティ YOUTUBE_API_KEY が未設定です。");
  return key;
}

function scoreAllChannels() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const inputSheet = ss.getActiveSheet();
  const values = inputSheet.getDataRange().getValues();
  if (values.length < 2) {
    SpreadsheetApp.getUi().alert("A列2行目以降にチャンネルURL/IDを入力してください。");
    return;
  }

  const inputs = values.slice(1).map(r => String(r[0]).trim()).filter(Boolean);

  let resultSheet = ss.getSheetByName("結果");
  if (!resultSheet) resultSheet = ss.insertSheet("結果");
  resultSheet.clear();
  resultSheet.appendRow(OUTPUT_HEADERS);

  inputs.forEach(input => {
    try {
      const row = evaluateChannel_(input);
      resultSheet.appendRow(row);
    } catch (err) {
      resultSheet.appendRow([input, "取得失敗", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "ERROR", String(err)]);
    }
    Utilities.sleep(200);
  });

  resultSheet.setFrozenRows(1);
  resultSheet.autoResizeColumns(1, OUTPUT_HEADERS.length);
}

function evaluateChannel_(input) {
  const channelId = resolveChannelId_(input);
  const ch = fetchChannel_(channelId);

  const snippet = ch.snippet;
  const stats = ch.statistics;
  const publishedAt = new Date(snippet.publishedAt);
  const now = new Date();

  const ageMonths = monthsBetween_(publishedAt, now);
  const subs = Number(stats.subscriberCount || 0);
  const videoCount = Number(stats.videoCount || 0);
  const totalViews = Number(stats.viewCount || 0);

  const uploadsPlaylist = ch.contentDetails.relatedPlaylists.uploads;
  const recent = fetchRecentVideoStats_(uploadsPlaylist, CRITERIA.recentVideoSample);

  const avgViews = avg_(recent.map(v => v.views));
  const avgLikes = avg_(recent.map(v => v.likes));
  const avgComments = avg_(recent.map(v => v.comments));
  const lastUpload = recent.length ? recent[0].publishedAt : null;
  const daysSinceUpload = lastUpload ? daysBetween_(lastUpload, now) : null;

  const viewSubRatio = subs > 0 ? avgViews / subs : 0;
  const engagementRate = avgViews > 0 ? (avgLikes + avgComments) / avgViews : 0;
  const subsPerMonth = ageMonths > 0 ? subs / ageMonths : subs;

  const axis1 = (ageMonths <= CRITERIA.maxChannelAgeMonths)
             && (daysSinceUpload !== null && daysSinceUpload <= CRITERIA.maxDaysSinceUpload);
  const axis2 = subsPerMonth >= CRITERIA.minSubsPerMonth;
  const axis3 = (viewSubRatio >= CRITERIA.minViewSubRatio)
             && (engagementRate >= CRITERIA.minEngagementRate)
             && (avgComments >= CRITERIA.minAvgComments);
  const axis4 = subs <= CRITERIA.maxSubsForReference;

  const pass = axis1 && axis2 && axis3 && axis4;
  const notes = [];
  if (!axis1) notes.push("鮮度NG");
  if (!axis2) notes.push("初動速度不足(近似)");
  if (!axis3) notes.push("エンゲージ不足");
  if (!axis4) notes.push("規模超過");

  return [
    input, snippet.title, channelId,
    formatDate_(publishedAt), ageMonths, lastUpload ? formatDate_(lastUpload) : "-", daysSinceUpload,
    subs, videoCount, totalViews,
    Math.round(avgViews), Math.round(avgLikes), Math.round(avgComments),
    pct_(viewSubRatio), pct_(engagementRate), Math.round(subsPerMonth),
    mark_(axis1), mark_(axis2), mark_(axis3), mark_(axis4),
    pass ? "◎ 参考候補" : "× 対象外",
    notes.join(" / ")
  ];
}

function resolveChannelId_(input) {
  if (/^UC[\w-]{22}$/.test(input)) return input;

  let handle = null;
  const handleMatch = input.match(/@([A-Za-z0-9._-]+)/);
  if (handleMatch) handle = handleMatch[1];
  else if (!input.includes("/")) handle = input.replace(/^@/, "");

  if (handle) {
    const res = ytApi_("channels", { part: "id", forHandle: "@" + handle });
    if (res.items && res.items.length) return res.items[0].id;
  }

  const idMatch = input.match(/channel\/(UC[\w-]{22})/);
  if (idMatch) return idMatch[1];

  const res = ytApi_("search", { part: "snippet", type: "channel", q: input, maxResults: 1 });
  if (res.items && res.items.length) return res.items[0].snippet.channelId;

  throw new Error("チャンネルIDを解決できませんでした: " + input);
}

function fetchChannel_(channelId) {
  const res = ytApi_("channels", { part: "snippet,statistics,contentDetails", id: channelId });
  if (!res.items || !res.items.length) throw new Error("チャンネルが見つかりません: " + channelId);
  return res.items[0];
}

function fetchRecentVideoStats_(uploadsPlaylistId, n) {
  const pl = ytApi_("playlistItems", { part: "contentDetails", playlistId: uploadsPlaylistId, maxResults: n });
  if (!pl.items || !pl.items.length) return [];
  const videoIds = pl.items.map(i => i.contentDetails.videoId).join(",");
  const vids = ytApi_("videos", { part: "statistics,snippet", id: videoIds });
  return (vids.items || []).map(v => ({
    publishedAt: new Date(v.snippet.publishedAt),
    views: Number(v.statistics.viewCount || 0),
    likes: Number(v.statistics.likeCount || 0),
    comments: Number(v.statistics.commentCount || 0)
  })).sort((a, b) => b.publishedAt - a.publishedAt);
}

function ytApi_(endpoint, params) {
  params.key = getApiKey_();
  const qs = Object.keys(params).map(k => k + "=" + encodeURIComponent(params[k])).join("&");
  const url = "https://www.googleapis.com/youtube/v3/" + endpoint + "?" + qs;
  const res = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
  const code = res.getResponseCode();
  const body = JSON.parse(res.getContentText());
  if (code !== 200) {
    const msg = body.error && body.error.message ? body.error.message : res.getContentText();
    throw new Error("API " + endpoint + " (" + code + "): " + msg);
  }
  return body;
}

function avg_(arr) { return arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0; }
function pct_(x) { return Math.round(x * 1000) / 10 + "%"; }
function mark_(b) { return b ? "○" : "×"; }
function monthsBetween_(a, b) {
  return Math.max(0, Math.round((b - a) / (1000 * 60 * 60 * 24 * 30.4)));
}
function daysBetween_(a, b) { return Math.round((b - a) / (1000 * 60 * 60 * 24)); }
function formatDate_(d) { return Utilities.formatDate(d, "JST", "yyyy-MM-dd"); }
