/**
 * Rapid Cycle — Google Apps Script バックアップ (v2: デッキ単位ファイル方式)
 *
 * 【セットアップ手順】→ gas/DEPLOY.md を参照
 *
 * 【ファイル構成 (Drive フォルダ内)】
 *   meta.json          — folders 情報
 *   deck_<id>.json     — 各デッキのデータ (単語 + stats)
 */

// ★ 必ず自分のフォルダIDに差し替えること
// Drive のフォルダ URL: https://drive.google.com/drive/folders/<FOLDER_ID>
var FOLDER_ID = "YOUR_DRIVE_FOLDER_ID_HERE";

// ─────────────────────────────────────────────
// エントリーポイント
// ─────────────────────────────────────────────

function doPost(e) {
  try {
    var req = JSON.parse(e.postData.contents);
    var action = req.action;

    if (action === "updateDeck")       return handleUpdateDeck(req.data);
    if (action === "updateMeta")       return handleUpdateMeta(req.data);
    if (action === "deleteDeck")       return handleDeleteDeck(req.deckId);
    if (action === "listDecks")        return handleListDecks();
    if (action === "getDeckSummaries") return handleGetDeckSummaries(req.deckIds);
    if (action === "getMeta")          return handleGetMeta();
    if (action === "getDeck")          return handleGetDeck(req.deckId);
    if (action === "getSummary")       return handleGetSummary();

    return jsonResponse({ ok: false, error: "unknown action: " + action });
  } catch (err) {
    return jsonResponse({ ok: false, error: String(err) });
  }
}

function doGet(e) {
  // バックアップ状態の簡易確認用 (getSummary を返す)
  try {
    return handleGetSummary();
  } catch (err) {
    return jsonResponse({ ok: false, error: String(err) });
  }
}

// ─────────────────────────────────────────────
// ハンドラー
// ─────────────────────────────────────────────

function handleUpdateDeck(data) {
  if (!data || !data.deck || !data.deck.id) {
    return jsonResponse({ ok: false, error: "invalid deck data" });
  }
  var filename = "deck_" + data.deck.id + ".json";
  upsertFile_(filename, JSON.stringify(data));
  return jsonResponse({ ok: true, deckId: data.deck.id });
}

function handleUpdateMeta(data) {
  upsertFile_("meta.json", JSON.stringify(data));
  return jsonResponse({ ok: true });
}

function handleDeleteDeck(deckId) {
  if (!deckId) return jsonResponse({ ok: false, error: "no deckId" });
  var folder = getFolder_();
  var filename = "deck_" + deckId + ".json";
  var files = folder.getFilesByName(filename);
  if (files.hasNext()) {
    files.next().setTrashed(true); // ゴミ箱へ（完全削除ではない）
  }
  return jsonResponse({ ok: true, deckId: deckId });
}

function handleListDecks() {
  var folder = getFolder_();
  var files = folder.getFiles();
  var deckIds = [];
  while (files.hasNext()) {
    var name = files.next().getName();
    var match = name.match(/^deck_(.+)\.json$/);
    if (match) deckIds.push(match[1]);
  }
  return jsonResponse({ ok: true, deckIds: deckIds });
}

function handleGetDeckSummaries(deckIds) {
  if (!Array.isArray(deckIds)) {
    return jsonResponse({ ok: false, error: "deckIds must be array" });
  }
  var folder = getFolder_();
  var summaries = [];
  for (var i = 0; i < deckIds.length; i++) {
    var deckId = deckIds[i];
    var filename = "deck_" + deckId + ".json";
    var files = folder.getFilesByName(filename);
    if (files.hasNext()) {
      try {
        var content = JSON.parse(files.next().getBlob().getDataAsString());
        summaries.push({
          id: deckId,
          name: (content.deck && content.deck.name) || "(no name)",
          wordCount: (content.deck && content.deck.words && content.deck.words.length) || 0,
        });
      } catch (err) {
        summaries.push({ id: deckId, name: "(parse error)", wordCount: 0 });
      }
    }
  }
  return jsonResponse({ ok: true, summaries: summaries });
}

function handleGetMeta() {
  var folder = getFolder_();
  var files = folder.getFilesByName("meta.json");
  if (!files.hasNext()) {
    return jsonResponse({ ok: true, data: { v: 2, folders: [] } });
  }
  try {
    var data = JSON.parse(files.next().getBlob().getDataAsString());
    return jsonResponse({ ok: true, data: data });
  } catch (err) {
    return jsonResponse({ ok: false, error: "meta.json parse error" });
  }
}

function handleGetDeck(deckId) {
  if (!deckId) return jsonResponse({ ok: false, error: "no deckId" });
  var folder = getFolder_();
  var filename = "deck_" + deckId + ".json";
  var files = folder.getFilesByName(filename);
  if (!files.hasNext()) {
    return jsonResponse({ ok: true, data: null });
  }
  try {
    var data = JSON.parse(files.next().getBlob().getDataAsString());
    return jsonResponse({ ok: true, data: data });
  } catch (err) {
    return jsonResponse({ ok: false, error: "deck parse error" });
  }
}

function handleGetSummary() {
  var folder = getFolder_();
  var deckCount = 0;
  var totalWordCount = 0;
  var folderCount = 0;

  // meta.json を読んでフォルダ数を取得
  var metaFiles = folder.getFilesByName("meta.json");
  if (metaFiles.hasNext()) {
    try {
      var meta = JSON.parse(metaFiles.next().getBlob().getDataAsString());
      folderCount = (meta.folders || []).length;
    } catch (e) {}
  }

  // 各 deck_ ファイルを読んで総語数を集計
  var allFiles = folder.getFiles();
  while (allFiles.hasNext()) {
    var file = allFiles.next();
    var name = file.getName();
    if (name.match(/^deck_.+\.json$/)) {
      deckCount++;
      try {
        var content = JSON.parse(file.getBlob().getDataAsString());
        totalWordCount += (content.deck && content.deck.words && content.deck.words.length) || 0;
      } catch (e) {}
    }
  }

  return jsonResponse({
    ok: true,
    summary: { folderCount: folderCount, deckCount: deckCount, totalWordCount: totalWordCount },
  });
}

// ─────────────────────────────────────────────
// ユーティリティ
// ─────────────────────────────────────────────

function getFolder_() {
  return DriveApp.getFolderById(FOLDER_ID);
}

function jsonResponse(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function upsertFile_(name, content) {
  var folder = getFolder_();
  var files = folder.getFilesByName(name);
  if (files.hasNext()) {
    files.next().setContent(content);
  } else {
    folder.createFile(name, content, MimeType.PLAIN_TEXT);
  }
}
