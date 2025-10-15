/**
 * Google Apps Script - 支出記録アプリとの同期
 * このコードをGoogleスプレッドシート「シン新人研修4.gsheet」に紐付けて使用します
 */

// スプレッドシートの設定
const SHEET_NAME = "支出データ";

/**
 * Webアプリケーションへの POST リクエストを処理
 */
function doPost(e) {
  try {
    // テスト実行時はeがundefinedまたはpostDataがない場合がある
    if (!e || !e.postData || !e.postData.contents) {
      Logger.log("No POST data received. Use testSync() for testing.");
      return ContentService.createTextOutput(
        JSON.stringify({
          status: "error",
          message: "No POST data received. This endpoint expects POST requests with JSON data."
        })
      ).setMimeType(ContentService.MimeType.JSON);
    }

    const data = JSON.parse(e.postData.contents);

    if (data.action === "syncExpenses") {
      syncExpensesToSheet(data.expenses);
      return ContentService.createTextOutput(
        JSON.stringify({ status: "success", count: data.expenses.length })
      ).setMimeType(ContentService.MimeType.JSON);
    }

    return ContentService.createTextOutput(
      JSON.stringify({ status: "error", message: "Unknown action" })
    ).setMimeType(ContentService.MimeType.JSON);

  } catch (error) {
    Logger.log("Error in doPost: " + error.toString());
    return ContentService.createTextOutput(
      JSON.stringify({ status: "error", message: error.toString() })
    ).setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * GET リクエストを処理（テスト用）
 */
function doGet(e) {
  return ContentService.createTextOutput(
    JSON.stringify({ status: "ok", message: "GAS endpoint is working" })
  ).setMimeType(ContentService.MimeType.JSON);
}

/**
 * 支出データをスプレッドシートに同期
 */
function syncExpensesToSheet(expenses) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_NAME);

  // シートが存在しない場合は作成
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
    initializeSheet(sheet);
  }

  // 既存データをクリア（ヘッダー行は残す）
  const lastRow = sheet.getLastRow();
  if (lastRow > 1) {
    sheet.getRange(2, 1, lastRow - 1, 6).clearContent();
  }

  // データが空の場合は終了
  if (!expenses || expenses.length === 0) {
    return;
  }

  // 新しいデータを書き込み
  const rows = expenses.map(expense => [
    expense.id || "",
    expense.date || "",
    expense.category || "",
    expense.amount || 0,
    expense.memo || "",
    new Date(expense.createdAt || Date.now())
  ]);

  // データを一括で書き込み
  sheet.getRange(2, 1, rows.length, 6).setValues(rows);

  // 日付でソート（降順）
  if (rows.length > 0) {
    sheet.getRange(2, 1, rows.length, 6).sort([
      { column: 2, ascending: false }, // 日付で降順
      { column: 6, ascending: false }  // 作成日時で降順
    ]);
  }

  Logger.log(`Synced ${expenses.length} expenses to sheet`);
}

/**
 * シートを初期化（ヘッダー行を設定）
 */
function initializeSheet(sheet) {
  const headers = ["ID", "日付", "カテゴリ", "金額", "メモ", "作成日時"];
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);

  // ヘッダー行のスタイル設定
  const headerRange = sheet.getRange(1, 1, 1, headers.length);
  headerRange.setFontWeight("bold");
  headerRange.setBackground("#4285f4");
  headerRange.setFontColor("#ffffff");

  // 列幅の調整
  sheet.setColumnWidth(1, 280); // ID
  sheet.setColumnWidth(2, 100); // 日付
  sheet.setColumnWidth(3, 100); // カテゴリ
  sheet.setColumnWidth(4, 100); // 金額
  sheet.setColumnWidth(5, 200); // メモ
  sheet.setColumnWidth(6, 150); // 作成日時

  // 金額列に通貨フォーマットを適用
  sheet.getRange(2, 4, 1000, 1).setNumberFormat("¥#,##0");

  // 日付列にフォーマットを適用
  sheet.getRange(2, 2, 1000, 1).setNumberFormat("yyyy-mm-dd");

  // 作成日時列にフォーマットを適用
  sheet.getRange(2, 6, 1000, 1).setNumberFormat("yyyy-mm-dd hh:mm:ss");

  // シートを固定
  sheet.setFrozenRows(1);
}

/**
 * テスト用：サンプルデータで同期をテスト
 */
function testSync() {
  const sampleExpenses = [
    {
      id: "test-1",
      date: "2025-10-15",
      category: "食費",
      amount: 1500,
      memo: "ランチ",
      createdAt: Date.now()
    },
    {
      id: "test-2",
      date: "2025-10-14",
      category: "交通費",
      amount: 500,
      memo: "電車代",
      createdAt: Date.now() - 86400000
    }
  ];

  syncExpensesToSheet(sampleExpenses);
  Logger.log("Test sync completed");
}
