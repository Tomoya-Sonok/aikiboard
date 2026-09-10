# tasks: Google OAuth ログイン

`specs/auth/plan.md` に基づくタスク分解。上から順に実施する。

- [x] T1. `frontend/src/lib/server/ensure-oauth-user.ts` を新規作成
  - `pickOAuthAvatarUrl`(AikiNote準拠、HEADで1MB判定)
  - `ensureOAuthUser`(`id`/`email`/`username`/`profile_image_url` の4列のみINSERT)
  - username 自動リトライ(`base` → `base2` → … 最大5回 → ランダムサフィックス1回)、20文字制約に合わせて基底を切り詰め
- [x] T2. `frontend/src/lib/server/ensure-oauth-user.test.ts` を新規作成(既存行/新規作成/衝突リトライ/アバターサイズ超過)
- [x] T3. `frontend/src/app/auth/callback/route.ts` を新規作成(`[locale]` の外)
  - `code` 無し → `/login`、交換失敗 → `/login?error=auth_error`、成功 → `ensureOAuthUser` → `/home`
  - `NEXT_LOCALE` cookie から locale 復元(`as-needed`)、`0.0.0.0` → `localhost` 正規化
- [x] T4. `frontend/src/lib/hooks/useAuth.tsx` に `signInWithGoogle()` を追加
- [x] T5. `frontend/src/components/features/auth/OAuthButtons/OAuthButtons.tsx` + `.module.css` を新規作成(GoogleロゴはインラインSVG、理由をコメントに残す)
- [x] T6. `login/page.tsx` と `signup/page.tsx` に `OAuthButtons` を配置
- [x] T7. `frontend/src/translations/ja.json` / `en.json` に `auth.oauth.*` を追加(ja/en 同数)
- [x] T8. `OAuthButtons.test.tsx` を新規作成(描画・クリックで呼ばれる)
- [x] T9. `pnpm -r check` と `pnpm -r test:ci` が通ることを確認
