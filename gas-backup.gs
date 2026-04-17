/**
 * Rapid Cycle — Google Apps Script バックアップ用スクリプト
 *
 * 【セットアップ手順】
 *   1. https://script.google.com/ で新規プロジェクトを作成
 *   2. このファイルの内容をエディタ（コード.gs）に貼り付けて保存
 *   3. 上部メニュー「デプロイ」→「新しいデプロイ」
 *        - 種類: ウェブアプリ
 *        - 次のユーザーとして実行: 自分
 *        - アクセスできるユーザー: 全員
 *   4. 表示された「ウェブアプリのURL」をコピー
 *   5. Rapid Cycle の「設定 → クラウドバックアップ」に貼り付け
 *
 * 【既に複数のスプレッドシートができてしまった場合】
 *   いずれか 1 つを残して他を削除し、残したファイルの ID（URL の /d/〜/edit の間）を
 *   Apps Script のプロジェクト設定 → スクリプトプロパティで
 *   キー名 "SPREADSHEET_ID" に設定してください。以降はそのシートが再利用されます。
 *
 * 【挙動】
 *   - doPost: 受信した JSON 文字列を「RapidCycleBackup」シートの A1 に保存
 *             （シートがなければ自動作成）
 *   - doGet : A1 に保存された JSON 文字列を読み取って返す
 *
 * 【注意】
 *   GAS の Web アプリは POST に対して 302 リダイレクトを返すため、
 *   クライアント側では redirect: "follow" を指定する必要があります。
 */

var SHEET_NAME = "RapidCycleBackup";

function getSheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) {
    // スタンドアロンGASの場合: 初回のみ新規作成し、ID を Script Properties に記録して以降は再利用
    var props = PropertiesService.getScriptProperties();
    var id = props.getProperty("SPREADSHEET_ID");
    if (id) {
      try {
        ss = SpreadsheetApp.openById(id);
      } catch (_) {
        ss = null;
      }
    }
    if (!ss) {
      ss = SpreadsheetApp.create("RapidCycleBackup");
      props.setProperty("SPREADSHEET_ID", ss.getId());
    }
  }
  var sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
  }
  return sheet;
}

function jsonOutput_(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  try {
    var raw = (e && e.postData && e.postData.contents) || "";
    var sheet = getSheet_();
    sheet.getRange(1, 1).setValue(raw);
    sheet.getRange(1, 2).setValue(new Date().toISOString());
    return jsonOutput_({ ok: true, savedAt: new Date().toISOString() });
  } catch (err) {
    return jsonOutput_({ ok: false, error: String(err) });
  }
}

function doGet(e) {
  try {
    // GET パラメータで data=... が来た場合はバックアップ（fallback 用）
    if (e && e.parameter && typeof e.parameter.data === "string" && e.parameter.data.length > 0) {
      var sheet = getSheet_();
      sheet.getRange(1, 1).setValue(e.parameter.data);
      sheet.getRange(1, 2).setValue(new Date().toISOString());
      return jsonOutput_({ ok: true, savedAt: new Date().toISOString() });
    }
    var s = getSheet_();
    var raw = s.getRange(1, 1).getValue();
    if (!raw) {
      return jsonOutput_({ ok: true, data: null });
    }
    var parsed = null;
    try { parsed = JSON.parse(raw); } catch (_) { parsed = null; }
    return jsonOutput_({ ok: true, data: parsed });
  } catch (err) {
    return jsonOutput_({ ok: false, error: String(err) });
  }
}
