使い方
1. GASプロジェクトを作る（別アカウントで使用する時）
  -https://script.google.com にアクセス
  -「新しいプロジェクト」→ デフォルトの myFunction を全部消してこのコードを貼り付け、保存（Ctrl+S）

2. emptyTrash() を使う場合は Gmail Advanced Service を有効化（任意）
　- 左サイドバー「サービス」→「Gmail API」を追加

3. 実行手順
   ①checkCount()　　　　　　　　　　　件数確認（何もしない）
   ②moveLargeAttachmentsToTrash()　　5MB超の添付から先に片付け
   ③moveOldEmailsToTrash()　　　　　カテゴリ別に一括ゴミ箱移動
   ④emptyTrash()　　　　　　　　　　　ゴミ箱を完全削除
   
注意点：
 - GASは1実行6分制限なので、35,000件超は③を何度か繰り返す必要がある
 - トリガー設定で自動繰り返しも可能（コード末尾の autoCleanup 参照）
 - DRY_RUN = true にするとテスト動作（実際には動かない）できる

初回は必ず checkCount() から始めること！
