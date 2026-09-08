# ボードTodo

## 概要

owner/admin専用の運営タスク管理機能。タイトル・担当者(管理者限定)・備考・ステータス・期限を持つTodoをステータス別カラム(未着手/進行中/完了)で管理する。**有料プラン機能ではない**。

## ユーザーストーリー

- 管理者として、運営タスク(例:「体育館の鍵を返却」)を担当者(他の管理者)にアサインして進捗を追いたい(`frontend/src/components/features/todo/TodoForm/TodoForm.tsx`)。
- タスクをカンバン形式(未着手/進行中/完了の3カラム)で俯瞰し、ステータスをドロップダウンで素早く変更したい(`TodoView.tsx`)。
- 担当者になれる管理者が一人もいない場合、先にメンバーを管理者に昇格するよう促されたい(「担当者にできる管理者(owner/admin)がいません。先にメンバーを管理者にしてください。」)— ただし[members](../members/spec.md)にロール変更機能自体が実装されておらず、この案内通りの対処ができない状態にある。
- 一般メンバーはこの機能自体にアクセスできない(運営専用ツールとしての設計)。

## 機能要件

- ✅ Todoの作成・一覧・編集・削除(`GET/POST /api/board-todos`, `PATCH/DELETE /api/board-todos/:id`)— `backend/src/routes/board-todos/index.ts`
- ✅ タイトルは1〜20文字必須、備考は300文字以内(フロント・バックエンド・DB制約の三重チェック)— `TodoForm.tsx`, `board-todos/index.ts`, `016_create_board_todos.sql`
- ✅ 担当者は必須かつ「ボードのowner/admin」に限定(一般メンバーは選択不可、選択しても400エラー)— `board-todos.test.ts`
- ✅ ステータスは`todo/in_progress/done`の3値、期限(`dueDate`)は任意
- ✅ アクセスはowner/adminのみ(閲覧含む)。memberは一覧取得すら403 — `boardTodoAdminMiddleware`
- ✅ フロント側でも非管理者はホームへリダイレクト、ナビゲーションで`adminOnly:true`(PROバッジなし)
- 🚧 `order_index`カラムはDBに存在するが「同一ステータス内の並び順(将来の手動並べ替え用)」とコメントされており、現状は常に`0`(挿入時に指定なし)。フロントに並び替えUIなし
- ✅ 本機能には`requireFeature`呼び出しが一切なく、feature_flagによるプラン制御対象外(有料機能ではない)

## 画面・API・テーブルの対応

- 画面: `frontend/src/app/[locale]/d/[slug]/todo/page.tsx` → `TodoView` / `TodoForm`
- API: tRPC `boardTodos.list/assignees/create/update/remove`
- テーブル: `aikiboard.board_todos`。RLSもowner/admin限定

## 未決事項

- [TBD] 手動並べ替え(ドラッグ&ドロップ等)の実装時期・要否

## この粒度で切った理由

専用ルート(`board-todos`)・専用テーブル(`board_todos`)・専用画面(`TodoView`/`TodoForm`)という1対1の実装境界を持つため独立させた。[archive](../archive/spec.md)・[finance](../finance/spec.md)と異なりfeature_flag制御が無い点が特徴的。
