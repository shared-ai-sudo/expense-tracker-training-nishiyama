# 支出記録アプリ - Google スプレッドシート連携ガイド

このアプリはブラウザの `localStorage` に支出データを保存しつつ、Google Apps Script(GAS) 経由で Google スプレッドシートへ同期できるように拡張されています。ここでは連携のための準備とテスト手順をまとめます。

## 1. スプレッドシートと Apps Script の準備

1. **スプレッドシートを作成**
   - 例: `Expense Tracker`
   - 1 行目にヘッダーを用意すると管理が楽です（例: `id`, `date`, `amount`, `category`, `memo`, `createdAt`, `syncedAt`）。

2. **スプレッドシートに紐づく Apps Script を作成**
   - スプレッドシートから `拡張機能` → `Apps Script` を開き、以下のサンプルを貼り付けます。

     ```javascript
     const SHEET_NAME = 'シート1'; // 保存先のシート名に合わせて変更

     function doPost(e) {
       try {
         const payload = JSON.parse(e.postData.contents);
         if (payload.action !== 'syncExpenses' || !Array.isArray(payload.data)) {
           return ContentService.createTextOutput(
             JSON.stringify({ ok: false, message: 'Invalid payload' })
           ).setMimeType(ContentService.MimeType.JSON);
         }

         const sheet = SpreadsheetApp.getSheetByName(SHEET_NAME);
         if (!sheet) {
           throw new Error(`${SHEET_NAME} が見つかりません`);
         }

         // 既存データを全削除して全同期するシンプルな処理
         const lastRow = sheet.getLastRow();
         if (lastRow > 1) {
           sheet.getRange(2, 1, lastRow - 1, sheet.getLastColumn()).clearContent();
         }

         const rows = payload.data.map((item) => [
           item.id,
           item.date,
           item.amount,
           item.category,
           item.memo,
           item.createdAt,
           payload.syncedAt,
         ]);

         if (rows.length > 0) {
           sheet.getRange(2, 1, rows.length, rows[0].length).setValues(rows);
         }

         return ContentService.createTextOutput(
           JSON.stringify({ ok: true })
         ).setMimeType(ContentService.MimeType.JSON);
       } catch (error) {
         return ContentService.createTextOutput(
           JSON.stringify({ ok: false, message: error.message })
         ).setMimeType(ContentService.MimeType.JSON);
       }
     }
     ```

3. **Web アプリとしてデプロイ**
   - `デプロイ` → `新しいデプロイ` を選択し、種類に「ウェブアプリ」を指定。
   - `実行するアプリケーション` は自分 (`自分`) に設定。
   - `アクセスできるユーザー` は用途に応じて選択（社内のみなら「自分」、共有するなら「全員」など）。
   - デプロイ後に発行される URL を控えます（例: `https://script.google.com/macros/s/xxxx/exec`）。

## 2. フロントエンドへの設定

1. `main.js` の冒頭付近にある次の定数をデプロイした URL に置き換えます。

   ```javascript
   const GAS_ENDPOINT = "https://script.google.com/macros/s/XXXX/exec";
   ```

2. ファイルを保存し、ブラウザで `index.html` を再読み込みします。

## 3. 動作確認

1. アプリで支出を追加すると、ヘッダー右上にあるステータスが「クラウド同期中…」→「クラウド保存済み」と変化します。
2. スプレッドシートを開き、指定したシートに行が追加されているか確認してください。
3. データ削除時も全データを再送信するため、シートの内容がアプリ側と同じになることを確認します。

## 4. 注意事項

- GAS は無認証公開にすると誰でも書き込めてしまうため、アクセス権の設定や受け入れるオリジンを慎重に管理してください。
- ネットワークエラーが発生した場合はコンソールに詳細が出力されます。ステータスが「クラウド同期に失敗しました」と表示されたら、通信状況と GAS 側のログ（`実行ログ`）を確認してください。
- 現状は「全件同期」の実装です。差分更新や読み込みの実装が必要な場合は、Apps Script 側のロジックを調整してください。

以上で Google スプレッドシート連携の設定は完了です。必要に応じてシートの列構成や GAS の認証方式をカスタマイズしてください。
