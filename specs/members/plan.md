# plan: ロール変更(アドミン任命・解除)

`specs/members/spec.md` の「ロール変更の仕様」を実装するための方針。2026-09-10 作成。

## 調査で判明した既存構造

- `backend/src/middleware/boardAccess.ts` の `createBoardGuard(level, idTable)` が認可の唯一の砦。`AccessLevel` は現在 `"member" | "admin"` の2値。
- ボードID解決は `:id` ルートパラメータ →`?boardId=` → JSON body の順。**ロール変更は `:userId` パラメータなので `:id` 分岐に該当せず、body の `boardId` で解決される**(既存の `POST /api/members/leave` と同じ経路)。
- 既存の `DELETE /api/members/:userId` が「自分自身は不可」「対象が owner なら400」「対象が存在しなければ404」という判定を持つ。ロール変更もこの判定パターンを踏襲する。
- `logActivity`(`lib/activity.ts`)と `createNotifications`(`lib/notifications.ts`)はいずれも失敗しても本処理を止めない設計。

## 変更内容

### backend

1. **`lib/activity.ts`**: `ActivityAction` に `"member.role_changed"` を追加。
2. **`lib/notifications.ts`**: `NotificationType` に `"member.role_changed"` を追加。
3. **`routes/members/index.ts`**: `PATCH /:userId/role` を追加(`authMiddleware` → `boardAdminMiddleware`)。
   - 入力: `{ boardId: uuidLike, role: "admin" | "member" }`(zod、既存の `leaveSchema` と同じ `uuidLike` を再利用)
   - 判定順: 自分自身(400)→ 対象の現在ロール取得(取得失敗500 / 不在404)→ 対象が owner(400)→ 現在と同じロール(400)
   - 更新: `board_members` の `role` を UPDATE
   - 副作用: `logActivity`(`member.role_changed`、`title` に対象ユーザー名)、`createNotifications`(対象1名のみ)

### frontend

4. **`server/trpc/routers/members.ts`**: `changeRole` mutation を追加(`PATCH /api/members/:userId/role`)。
5. **`components/features/members/MembersView/MembersView.tsx`**: 各行にロール変更ボタンを追加。
   - 表示条件: `canManage && member.role !== "owner" && !isSelf`
   - `member` なら「管理者にする」(`ArrowUp` 相当のアイコン)、`admin` なら「管理者を解除」
   - 確認は `window.confirm`(既存の削除・退会と同じ)
   - 成功時は既存の `refresh()` で一覧を再取得
6. **`MembersView.module.css`**: ボタンのスタイルは既存 `.action` を再利用するため追加なし(必要なら最小限)。
7. **翻訳(`translations/ja.json` / `en.json`)**: `boards.members` に `promote` / `demote` / `promoteConfirm` / `demoteConfirm`、`boards.activity` に `member_role_changed` を追加。ja/en 両方に同数のキーを入れる(423キー完全一致の既存状態を崩さない)。

### テスト

8. **`routes/members/members.test.ts`**: 既存のモックパターン(手書き Supabase スタブ)を踏襲し、以下を追加。
   - owner が member を admin に昇格できる(200)
   - admin が member を admin に昇格できる(今回の決定により admin にも権限がある)
   - member が実行すると403
   - 対象が owner なら400
   - 自分自身なら400

## 実装順序

`lib/activity.ts` / `lib/notifications.ts` の型追加 → backend ルート → backend テスト → tRPC ルーター → UI → 翻訳。

## リスクと対応

- **admin 同士の昇格連鎖**: 今回の決定(admin も実行可)により、admin が別の member を admin にできる。ガバナンス上のリスクはユーザー承認済み。owner だけは変更対象外なので、ボードの最終決定権は保たれる。
- **`:userId` と `:id` の混同**: `boardAccess` の `:id` 分岐に入らないことを前提にしているため、ルートパラメータ名を `:userId` から変えない。
