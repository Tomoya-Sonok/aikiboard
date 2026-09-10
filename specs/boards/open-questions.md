# open-questions: boards

`docs/prd/dojo-platform-vision.md`(prd-refine、2026-09-10)から転記。

| 番号 | 質問 | 推奨案 | 影響範囲 | 状態 |
|---|---|---|---|---|
| Q1 | ボード削除API(`DELETE /api/boards/:id`)のレスポンス時間の具体的な目標値は?(CASCADE削除+Storage削除を含む) | 同期処理で完結させ、明確な数値目標なしで着手可。将来的にデータ量が増えたら非同期化を検討 | ボード削除API | open |
