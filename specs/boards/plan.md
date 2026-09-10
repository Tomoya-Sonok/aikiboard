# plan: ボード削除

`specs/boards/spec.md` の「ボード削除の仕様」を実装するための方針。2026-09-10 作成。

## 調査で判明した既存構造

- **FK の CASCADE は完全に定義済み**。`backend/src/migrations/*.sql` を全走査した結果、`aikiboard` スキーマで `boards(id)` を参照する全テーブル(`board_settings` / `board_members` / `board_dojo_masters` / `invitations` / `activity_logs` / `events` / `announcements` / `board_posts` / `archives` / `member_fees` / `fee_payments` / `expense_entries` / `board_subscriptions` / `membership_requests` / `notifications` / `board_todos`)が `ON DELETE CASCADE`。孫テーブル(`event_rsvps` / `event_overrides` / `announcement_reads` / `board_post_attachments` / `threads` / `archive_attachments`)も親に対して CASCADE。
  → **`DELETE FROM aikiboard.boards WHERE id = ?` の1文で全て連鎖削除される。明示削除は不要**(spec.md の「CASCADE未定義のテーブルは明示削除」という条件は、調査の結果、該当なしと確定)。
- `backend/src/routes/boards/index.ts` は `authMiddleware` のみ使用し、`boardAccess` ミドルウェアを使っていない。既存ルートは `GET /`、`GET /:slug`、`POST /`。
- `boardAccess.ts` の `AccessLevel` は `"member" | "admin"` の2値で **owner 限定のガードが存在しない**。`IdTable` にも `boards` が無い(`:id` から `board_id` カラムを引く前提のため、boards 自身は表現できない)。
- `lib/storage.ts` に `removeObjects(paths)` はあるが、プレフィックス配下の一括削除は無い。

## 変更内容

### backend

1. **`middleware/boardAccess.ts`**(拡張):
   - `AccessLevel` に `"owner"` を追加し、`level === "owner" && role !== "owner"` なら403を返す分岐を追加。
   - `IdTable` に `"boards"` を追加し、`resolveBoardId` で **`idTable === "boards"` の場合は `:id` 自体を boardId として返す**分岐を追加(boards テーブルには `board_id` カラムが無いため)。
   - `boardOwnerMiddleware = createBoardGuard("owner", "boards")` をエクスポート。
2. **`lib/storage.ts`**: `removeBoardMedia(supabase, boardId)` を追加。`feed/<boardId>` と `archive/<boardId>` を `storage.from().list()` で列挙し、`removeObjects` に渡す。ベストエフォート(失敗はログのみ)。
3. **`routes/boards/index.ts`**:
   - `GET /:id/deletion-summary`(`authMiddleware` → `boardOwnerMiddleware`): メンバー数・投稿数・稽古数・お知らせ数・アーカイブ数を `count: "exact"` で集計して返す。
   - `DELETE /:id`(`authMiddleware` → `boardOwnerMiddleware`): `removeBoardMedia` を先に実行(ベストエフォート)→ `boards` を DELETE。
   - **ルート登録順**: `GET /:slug`(1セグメント)と `GET /:id/deletion-summary`(2セグメント)はセグメント数が違うため競合しない。`DELETE /:id` はメソッドが異なるため競合しない。
   - `activity_logs` への記録はしない(ボードごと CASCADE で消えるため無意味)。

### frontend

4. **`server/trpc/routers/boards.ts`**: `deletionSummary` query と `remove` mutation を追加。
5. **`app/[locale]/d/[slug]/settings/page.tsx`**: `SettingsView` に `boardName={board.name}` と `viewerRole={board.viewerRole}` を渡す(`BoardDetail` に `name` / `viewerRole` が既にある)。
6. **`components/features/settings/SettingsView/SettingsView.tsx`**: 末尾に「危険な操作」セクションを追加。
   - **owner にのみ表示**(`viewerRole === "owner"`)
   - 「ボードを削除」ボタン → 共通 `Dialog`(`components/shared/Dialog`)を開く
   - Dialog 内: `deletionSummary` の集計表示 +「ボード名を入力してください」の入力欄。入力値が `boardName` と完全一致した時のみ削除ボタンを有効化
   - 削除成功後は `router.replace("/home")`
7. **`SettingsView.module.css`**: 危険な操作セクション(赤系の枠線)のスタイルを追加。色は `--ab-*` トークンを使い、ハードコードしない。
8. **翻訳(`ja.json` / `en.json`)**: `boards.settings` に `dangerZone` / `deleteBoard` / `deleteDialogTitle` / `deleteWarning` / `deleteSummary` / `deleteNameLabel` / `deleteConfirm` / `deleting` / `deleteError` / `cancel` を追加。ja/en 両方に同数。

### テスト

9. **`routes/boards/boards.test.ts`**: 既存モックパターンを踏襲し、以下を追加。
   - owner が削除できる(200)
   - admin が削除しようとすると403
   - member が削除しようとすると403
   - 非メンバーは404

## 実装順序

`boardAccess.ts` の owner レベル追加 → `storage.ts` のヘルパ → backend ルート → backend テスト → tRPC ルーター → page.tsx の props → UI → 翻訳。

## リスクと対応

- **削除の不可逆性**: 物理削除のため復旧不可。ボード名入力一致の確認で誤操作を防ぐ。
- **Storage 削除の失敗**: DB 削除はロールバックしない(孤児ファイルを許容)。`removeObjects` の既存方針(警告ログのみ)を踏襲。
- **`boardAccess` 拡張の影響範囲**: `AccessLevel` への値追加と `IdTable` への値追加は、既存のミドルウェア(member/admin レベル、他の idTable)の挙動を変えない。既存テスト(`middleware/boardAccess.test.ts`)が通ることで担保する。
