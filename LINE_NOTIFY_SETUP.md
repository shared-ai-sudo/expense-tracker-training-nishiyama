# LINE Notify セットアップ手順

課題完了報告をLINEに通知するための設定方法です。

## 1. LINE Notifyアクセストークンの取得

### 手順

1. **LINE Notifyにアクセス**
   - https://notify-bot.line.me/ を開く
   - LINEアカウントでログイン

2. **マイページを開く**
   - 右上のユーザー名をクリック
   - 「マイページ」を選択

3. **アクセストークンを発行**
   - 下にスクロールして「トークンを発行する」ボタンをクリック
   - トークン名: 「課題完了報告」など任意の名前を入力
   - 通知先: 「1:1でLINE Notifyから通知を受け取る」または通知したいグループを選択
   - 「発行する」ボタンをクリック

4. **トークンをコピー**
   - 表示されたアクセストークンをコピー
   - ⚠️ **重要**: このトークンは二度と表示されないので、必ずコピーしてください

## 2. Google Apps Scriptにトークンを設定

1. **Apps Scriptエディタを開く**
   - Googleスプレッドシート「シン新人研修4.gsheet」を開く
   - **拡張機能 > Apps Script** を選択

2. **トークンを設定**
   - `Code.gs`の10行目を編集:

   ```javascript
   const LINE_NOTIFY_TOKEN = "YOUR_LINE_NOTIFY_TOKEN_HERE";
   ```

   ↓

   ```javascript
   const LINE_NOTIFY_TOKEN = "コピーしたトークンをここに貼り付け";
   ```

3. **保存してデプロイ**
   - **保存**ボタンをクリック（Ctrl+S または Cmd+S）
   - すでにデプロイ済みの場合は、**デプロイ > デプロイを管理** から既存のデプロイを選択
   - 右上の鉛筆アイコンをクリック
   - 「新しいバージョン」を選択
   - **デプロイ** をクリック

## 3. 動作確認

### テスト関数で確認

1. Apps Scriptエディタで関数選択ドロップダウンから `testLineNotification` を選択
2. **実行** ボタンをクリック
3. LINEに以下のような通知が届くことを確認:

```
【🎉課題4完了報告🎉】
研修生：田中太郎（user01）
完了：2025/10/20 15:30

アプリURL:
https://your-github-username.github.io/expense-app

仕様書URL:
https://github.com/your-github-username/expense-app/blob/main/spec.md

確認をお願いします！
```

### 実際のアプリから確認

1. HTMLアプリ（index.html）をブラウザで開く
2. 右上の **🎉 課題完了報告** ボタンをクリック
3. フォームに情報を入力して送信
4. LINEに通知が届くことを確認

## トラブルシューティング

### LINE通知が届かない場合

1. **トークンが正しく設定されているか確認**
   - `Code.gs`の10行目を確認
   - トークンが`YOUR_LINE_NOTIFY_TOKEN_HERE`のままになっていないか

2. **デプロイが最新版か確認**
   - Apps Scriptエディタで **デプロイ > デプロイを管理** を開く
   - 最新バージョンがデプロイされているか確認

3. **Apps Scriptのログを確認**
   - Apps Scriptエディタで実行ログを開く（Ctrl+Enter）
   - エラーメッセージがないか確認

4. **LINE Notifyのトークンが有効か確認**
   - https://notify-bot.line.me/my/ にアクセス
   - 発行したトークンが「連携中のサービス」に表示されているか確認

### トークンを再発行する場合

1. https://notify-bot.line.me/my/ にアクセス
2. 古いトークンを削除（右側の「トークンを削除する」ボタン）
3. 新しいトークンを発行（上記手順1を参照）
4. `Code.gs`のトークンを更新（上記手順2を参照）

## セキュリティに関する注意

- ⚠️ **LINE Notifyのトークンは秘密情報です**
- トークンをGitHubなどの公開リポジトリにコミットしないでください
- トークンが漏洩した場合は、すぐに削除して再発行してください
- Apps Scriptは非公開のままにしてください

## 通知先を変更する場合

1. https://notify-bot.line.me/my/ にアクセス
2. 現在のトークンを削除
3. 新しいトークンを発行（通知先を変更して発行）
4. `Code.gs`のトークンを更新

## 参考リンク

- LINE Notify公式: https://notify-bot.line.me/
- LINE Notify API Document: https://notify-bot.line.me/doc/ja/
