# tasks: ボード削除

`specs/boards/plan.md` に基づくタスク分解。上から順に実施する。

- [x] T1. `backend/src/middleware/boardAccess.ts` を拡張
  - `AccessLevel` に `"owner"` を追加 + 403 分岐
  - `IdTable` に `"boards"` を追加 + `resolveBoardId` で `:id` をそのまま boardId とする分岐
  - `boardOwnerMiddleware` をエクスポート
- [x] T2. `backend/src/lib/storage.ts` に `removeBoardMedia(supabase, boardId)` を追加(`feed/<boardId>` と `archive/<boardId>` を list → remove、ベストエフォート)
- [x] T3. `backend/src/routes/boards/index.ts` に `GET /:id/deletion-summary` を追加(owner限定、メンバー数・投稿数・稽古数・お知らせ数・アーカイブ数を集計)
- [x] T4. `backend/src/routes/boards/index.ts` に `DELETE /:id` を追加(owner限定、Storage削除→boards DELETE)
- [x] T5. `backend/src/routes/boards/boards.test.ts` にテストを追加(owner 200 / admin 403 / member 403 / 非メンバー404)
- [x] T6. `frontend/src/server/trpc/routers/boards.ts` に `deletionSummary` query と `remove` mutation を追加
- [x] T7. `frontend/src/app/[locale]/d/[slug]/settings/page.tsx` から `boardName` と `viewerRole` を `SettingsView` に渡す
- [x] T8. `frontend/src/components/features/settings/SettingsView/SettingsView.tsx` に「危険な操作」セクションを追加(owner のみ、共通 `Dialog` + ボード名入力一致 + 集計表示 + 削除後 `/home` へ)
- [x] T9. `frontend/src/components/features/settings/SettingsView/SettingsView.module.css` に危険な操作セクションのスタイルを追加(`--ab-*` トークン使用、色のハードコード禁止)
- [x] T10. `frontend/src/translations/ja.json` / `en.json` に `boards.settings` の削除関連キーを追加
- [x] T11. `pnpm -r check` と `pnpm -r test:ci` が通ることを確認
