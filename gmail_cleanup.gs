/**
 * Gmail 一括削除スクリプト
 * 2023年より前のメールをゴミ箱に移動し、最終的に完全削除する
 *
 * 使い方：
 *   1. https://script.google.com にアクセス
 *   2. 「新しいプロジェクト」を作成
 *   3. このファイルの内容を貼り付けて保存
 *   4. まず checkCount() を実行して件数を確認
 *   5. 問題なければ moveOldEmailsToTrash() を実行（繰り返し）
 *   6. ゴミ箱に全部入ったら emptyTrash() を実行
 */

// ===== 設定 =====
const CUTOFF_DATE = "2025/1/1";   // これより前のメールが対象
const BATCH_SIZE  = 500;          // 1回の実行で処理する件数（最大500）
const DRY_RUN     = false;        // true にするとゴミ箱移動をスキップ（テスト用）

// 削除対象のカテゴリ（メインとラベル付きメールを除外）
const QUERIES = [
  `before:${CUTOFF_DATE} category:promotions -category:primary -has:userlabels`,
  `before:${CUTOFF_DATE} category:social -category:primary -has:userlabels`,
  `before:${CUTOFF_DATE} category:updates -category:primary`,
  `before:${CUTOFF_DATE} category:forums -category:primary`,
  // `before:${CUTOFF_DATE} in:inbox`,
  // `before:${CUTOFF_DATE} in:sent`,
  `before:${CUTOFF_DATE} in:spam`,
];


// ===== メイン処理 =====

/**
 * 削除対象の件数を確認する（実際には何もしない）
 * まずこれを実行してください
 */
function checkCount() {
  Logger.log("=== 削除対象 件数チェック ===");
  Logger.log(`カットオフ日: ${CUTOFF_DATE} より前`);
  Logger.log("");

  let totalEstimate = 0;

  QUERIES.forEach(query => {
    const threads = GmailApp.search(query, 0, 500);
    Logger.log(`[${query}] → 取得件数: ${threads.length} スレッド（上限500）`);
    totalEstimate += threads.length;
  });

  Logger.log("");
  Logger.log(`合計（概算）: ${totalEstimate} スレッド`);
  Logger.log("※ 実際はさらに多い可能性があります（500件上限のため）");
  Logger.log("※ 件数を確認したら moveOldEmailsToTrash() を実行してください");
}


/**
 * 古いメールをゴミ箱に移動する
 * 35,000件超の場合はこの関数を複数回実行してください
 * （時間制限：GASは1回の実行で最大6分）
 */
function moveOldEmailsToTrash() {
  Logger.log("=== ゴミ箱への移動 開始 ===");
  Logger.log(`DRY_RUN: ${DRY_RUN}`);
  Logger.log("");

  let totalMoved = 0;
  const startTime = Date.now();

  for (const query of QUERIES) {
    // 時間制限に近づいたら中断（5分30秒）
    if (Date.now() - startTime > 330000) {
      Logger.log("⚠️ 時間制限に近づいたため中断しました。再度実行してください。");
      break;
    }

    const threads = GmailApp.search(query, 0, BATCH_SIZE);

    if (threads.length === 0) {
      Logger.log(`[スキップ] ${query} → 0件`);
      continue;
    }

    Logger.log(`[処理中] ${query} → ${threads.length} スレッド`);

    if (!DRY_RUN) {
      // 100件ずつに分割してゴミ箱移動（API制限対策）
      for (let i = 0; i < threads.length; i += 100) {
        const chunk = threads.slice(i, i + 100);
        GmailApp.moveThreadsToTrash(chunk);
        Utilities.sleep(500); // API負荷軽減
      }
    }

    totalMoved += threads.length;
    Logger.log(`  → ${threads.length} 件をゴミ箱に移動しました`);
  }

  Logger.log("");
  Logger.log(`=== 完了: 合計 ${totalMoved} スレッドをゴミ箱に移動 ===`);

  if (totalMoved >= BATCH_SIZE) {
    Logger.log("⚠️ まだ残っている可能性があります。再度実行してください。");
  } else {
    Logger.log("✅ 全カテゴリ処理完了。emptyTrash() でゴミ箱を空にできます。");
  }
}


/**
 * ゴミ箱を空にする（完全削除・取り消し不可）
 * moveOldEmailsToTrash() が完了してから実行してください
 * 1回の実行で最大500スレッド削除可能
 * Gmailを手動で削除した方が早い（一瞬）！
 */
function emptyTrash() {
  Logger.log("=== ゴミ箱を空にします ===");
  Logger.log("⚠️ この操作は取り消せません");

  const trashThreads = GmailApp.getTrashThreads();          // ゴミ箱にある全スレッド
  trashThreads.forEach(t =>
    Gmail.Users.Threads.remove('me', t.getId())             // 完全削除
  );

  Logger.log("✅ ゴミ箱を空にしました");
}


/**
 * 添付ファイル付きの大きなメールを優先削除（ドライブ容量節約に効果的）
 * 通常の moveOldEmailsToTrash() の前に実行するのがおすすめ
 */
function moveLargeAttachmentsToTrash() {
  const query = `before:${CUTOFF_DATE} has:attachment larger:5M`;
  Logger.log(`=== 大きな添付ファイル付きメール削除 ===`);
  Logger.log(`検索クエリ: ${query}`);

  const threads = GmailApp.search(query, 0, BATCH_SIZE);
  Logger.log(`対象: ${threads.length} スレッド`);

  if (threads.length === 0) {
    Logger.log("対象メールなし");
    return;
  }

  if (!DRY_RUN) {
    for (let i = 0; i < threads.length; i += 100) {
      GmailApp.moveThreadsToTrash(threads.slice(i, i + 100));
      Utilities.sleep(500);
    }
  }

  Logger.log(`✅ ${threads.length} スレッドをゴミ箱に移動しました`);
}


// ===== タイマートリガー用（オプション） =====
/**
 * 時間ベースのトリガーを設定して自動実行する場合はこの関数を使う
 * Apps Script の「トリガー」から設定：
 *   関数: autoCleanup
 *   イベント: 時間主導型 → 毎分（完了するまで）
 */
function autoCleanup() {
  moveOldEmailsToTrash();
}
