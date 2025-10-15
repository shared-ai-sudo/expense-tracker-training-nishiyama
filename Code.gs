/**
 * Google Apps Script - 支出記録アプリとの同期
 * このコードをGoogleスプレッドシート「シン新人研修4.gsheet」に紐付けて使用します
 */

// スプレッドシートの設定
const SHEET_NAME = "支出データ";

// LINE Notify設定
const LINE_NOTIFY_TOKEN = "YOUR_LINE_NOTIFY_TOKEN_HERE"; // LINE Notifyのトークンを設定してください

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

    if (data.action === "submitCompletionReport") {
      sendCompletionReportToLine(data);
      return ContentService.createTextOutput(
        JSON.stringify({ status: "success", message: "Report sent to LINE" })
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
  // ユーザーのメールアドレスを取得してシート名を決定
  const userEmail = Session.getActiveUser().getEmail();
  const userName = userEmail.split('@')[0]; // @の前の部分を使用
  const sheetName = `支出データ_${userName}`;

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(sheetName);

  // シートが存在しない場合は作成
  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
    initializeSheet(sheet, userEmail);
  }

  // 既存データをクリア（ヘッダー行は残す）
  const lastRow = sheet.getLastRow();
  if (lastRow > 2) {
    sheet.getRange(3, 1, lastRow - 2, 6).clearContent();
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

  // データを一括で書き込み（3行目から開始、2行目はユーザー情報）
  sheet.getRange(3, 1, rows.length, 6).setValues(rows);

  // 日付でソート（降順）
  if (rows.length > 0) {
    sheet.getRange(3, 1, rows.length, 6).sort([
      { column: 2, ascending: false }, // 日付で降順
      { column: 6, ascending: false }  // 作成日時で降順
    ]);
  }

  Logger.log(`Synced ${expenses.length} expenses to sheet: ${sheetName}`);
}

/**
 * シートを初期化（ヘッダー行を設定）
 */
function initializeSheet(sheet, userEmail) {
  // 1行目: ヘッダー
  const headers = ["ID", "日付", "カテゴリ", "金額", "メモ", "作成日時"];
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);

  // ヘッダー行のスタイル設定
  const headerRange = sheet.getRange(1, 1, 1, headers.length);
  headerRange.setFontWeight("bold");
  headerRange.setBackground("#4285f4");
  headerRange.setFontColor("#ffffff");

  // 2行目: ユーザー情報
  const userInfo = [`ユーザー: ${userEmail}`, `最終更新: ${new Date().toLocaleString('ja-JP')}`, "", "", "", ""];
  sheet.getRange(2, 1, 1, 6).setValues([userInfo]);
  sheet.getRange(2, 1, 1, 6).setBackground("#e3f2fd");
  sheet.getRange(2, 1, 1, 6).setFontColor("#1565c0");

  // 列幅の調整
  sheet.setColumnWidth(1, 280); // ID
  sheet.setColumnWidth(2, 100); // 日付
  sheet.setColumnWidth(3, 100); // カテゴリ
  sheet.setColumnWidth(4, 100); // 金額
  sheet.setColumnWidth(5, 200); // メモ
  sheet.setColumnWidth(6, 150); // 作成日時

  // 金額列に通貨フォーマットを適用（3行目から）
  sheet.getRange(3, 4, 1000, 1).setNumberFormat("¥#,##0");

  // 日付列にフォーマットを適用（3行目から）
  sheet.getRange(3, 2, 1000, 1).setNumberFormat("yyyy-mm-dd");

  // 作成日時列にフォーマットを適用（3行目から）
  sheet.getRange(3, 6, 1000, 1).setNumberFormat("yyyy-mm-dd hh:mm:ss");

  // シートを固定（2行分）
  sheet.setFrozenRows(2);
}

/**
 * 課題完了報告をLINEに送信
 */
function sendCompletionReportToLine(data) {
  if (!LINE_NOTIFY_TOKEN || LINE_NOTIFY_TOKEN === "YOUR_LINE_NOTIFY_TOKEN_HERE") {
    Logger.log("LINE Notify token is not configured");
    return;
  }

  const message = `
【🎉課題4完了報告🎉】
研修生：${data.traineeName}（${data.traineeId}）
完了：${data.completedAt}

アプリURL:
${data.appUrl}

仕様書URL:
${data.specUrl}

確認をお願いします！
  `.trim();

  const options = {
    method: "post",
    headers: {
      "Authorization": "Bearer " + LINE_NOTIFY_TOKEN,
    },
    payload: {
      message: message
    },
    muteHttpExceptions: true
  };

  try {
    const response = UrlFetchApp.fetch("https://notify-api.line.me/api/notify", options);
    const responseCode = response.getResponseCode();

    if (responseCode === 200) {
      Logger.log("LINE notification sent successfully");
    } else {
      Logger.log("Failed to send LINE notification: " + responseCode + " - " + response.getContentText());
    }
  } catch (error) {
    Logger.log("Error sending LINE notification: " + error.toString());
  }
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
  const userEmail = Session.getActiveUser().getEmail();
  Logger.log(`Test sync completed for user: ${userEmail}`);
}

/**
 * すべてのユーザーシートを一覧表示
 */
function listAllUserSheets() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheets = ss.getSheets();

  Logger.log("=== ユーザーシート一覧 ===");
  sheets.forEach(sheet => {
    const name = sheet.getName();
    if (name.startsWith("支出データ_")) {
      const lastRow = sheet.getLastRow();
      const dataCount = lastRow > 2 ? lastRow - 2 : 0;
      Logger.log(`${name}: ${dataCount}件のデータ`);
    }
  });
}

/**
 * テスト用：LINE通知をテスト
 */
function testLineNotification() {
  const testData = {
    traineeName: "田中太郎",
    traineeId: "user01",
    completedAt: "2025/10/20 15:30",
    appUrl: "https://your-github-username.github.io/expense-app",
    specUrl: "https://github.com/your-github-username/expense-app/blob/main/spec.md"
  };

  sendCompletionReportToLine(testData);
  Logger.log("Test LINE notification sent");
}
