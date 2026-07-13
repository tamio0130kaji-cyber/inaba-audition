/**
 * セットアップ手順
 * 1. 新しいGoogleスプレッドシートを作成する
 * 2. 拡張機能 > Apps Script を開き、このファイルの内容を貼り付けて保存
 * 3. 右上「デプロイ」>「新しいデプロイ」を選択
 *    - 種類：ウェブアプリ
 *    - 実行ユーザー：自分
 *    - アクセスできるユーザー：全員
 * 4. デプロイ後に表示されるウェブアプリURLをコピー
 * 5. index.html の ENDPOINT_URL にそのURLを貼り付ける
 */

const HEADERS = [
  "送信日時","email","name","age","prefecture","occupation","height",
  "catchphrase","prosCons","friendsDescribe","hobby","holiday",
  "travelFreq","wantChildren","childrenCount","idealFamily","workLifeBalance",
  "relationshipStatus","marriageTimeline","marriagePartnerWish","howFoundInaba",
  "attractedTo","cookingForHim","firstDateSpot","messageToInaba","whyChooseMe",
  "photoUrl","introVideoUrl","prVideoUrl",
  "specialSkill","freeNote","mediaAppearance"
];

function doPost(e) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();

  if (sheet.getLastRow() === 0) {
    sheet.appendRow(HEADERS);
  }

  const data = JSON.parse(e.postData.contents);
  const row = HEADERS.map(key => {
    if (key === "送信日時") return new Date();
    return data[key] || "";
  });
  sheet.appendRow(row);

  return ContentService
    .createTextOutput(JSON.stringify({ result: "success" }))
    .setMimeType(ContentService.MimeType.JSON);
}
