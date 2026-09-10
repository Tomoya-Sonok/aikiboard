# tasks: ロール変更(アドミン任命・解除)

`specs/members/plan.md` に基づくタスク分解。上から順に実施する。

- [x] T1. `backend/src/lib/activity.ts` の `ActivityAction` に `"member.role_changed"` を追加
- [x] T2. `backend/src/lib/notifications.ts` の `NotificationType` に `"member.role_changed"` を追加
- [x] T3. `backend/src/routes/members/index.ts` に `PATCH /:userId/role` を追加
  - zod スキーマ(`{boardId, role}`)、`boardAdminMiddleware` 適用
  - 判定順: 自分自身400 → 対象取得(500/404)→ 対象owner 400 → 同一ロール400
  - `board_members` の role を UPDATE
  - `logActivity("member.role_changed")` + `createNotifications`(対象1名)
- [x] T4. `backend/src/routes/members/members.test.ts` にテストを追加(owner昇格200 / admin昇格200 / member 403 / 対象owner 400 / 自分自身400)
- [x] T5. `frontend/src/server/trpc/routers/members.ts` に `changeRole` mutation を追加
- [x] T6. `frontend/src/components/features/members/MembersView/MembersView.tsx` にロール変更ボタンを追加
  - 表示条件 `canManage && role !== "owner" && !isSelf`
  - `window.confirm` で確認 → `changeRole` → `refresh()`
- [x] T7. `frontend/src/translations/ja.json` / `en.json` にキー追加
  - `boards.members.promote` / `demote` / `promoteConfirm` / `demoteConfirm`
  - `boards.activity.member_role_changed`
- [x] T8. `pnpm -r check` と `pnpm -r test:ci` が通ることを確認
