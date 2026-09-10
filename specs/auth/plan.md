# plan: Google OAuth ログイン

`specs/auth/spec.md` の「OAuth ログインの仕様」を実装するための方針。2026-09-10 作成。

## 調査で判明した既存構造

### AikiBoard 側

- `frontend/src/lib/hooks/useAuth.tsx` の `AuthProvider` が `signInWithCredentials` / `signUp` / `signOut` を提供。`supabase.auth` をブラウザから直接呼ぶ(BFF非経由)。
- `frontend/src/lib/supabase/server.ts` に **`getServiceRoleSupabase()` が既にある**(cookie非依存、`SUPABASE_SERVICE_ROLE_KEY` 使用)。新規作成不要。
- `frontend/src/lib/utils/env.ts` に **`getBaseUrl()` が既にある**(ブラウザは `window.location.origin`、サーバは `NEXT_PUBLIC_APP_URL`)。`redirectTo` の組み立てに流用する。
- ログイン/サインアップページは `frontend/src/app/[locale]/(public)/{login,signup}/page.tsx`。フォーム本体は `components/features/auth/{LoginForm,SignUpForm}`、共有CSSは `components/features/auth/authForm.module.css` / `authPage.module.css`。
- 既存の `POST /api/users`(backend)は `id`/`email`/`username` の**3列のみ** INSERT。コメントに「ローカル seed に合わせ」と明記。
- `frontend/src/lib/i18n/routing.ts` は `localePrefix: "as-needed"`(既定 ja はprefix無し)。

### AikiNote 側(準拠元)

- `frontend/src/app/auth/callback/route.ts`: `[locale]` の**外**に置かれた route handler。`exchangeCodeForSession` → `ensureOAuthUser` → リダイレクト。`NEXT_LOCALE` cookie から locale を復元してリダイレクト先を組み立てる。`0.0.0.0` を `localhost` に正規化する処理あり。
- `frontend/src/lib/server/ensure-oauth-user.ts`: `getServiceRoleSupabase()` で `User` 行の存在を確認し、無ければ INSERT。`pickOAuthAvatarUrl` で HEAD リクエストによる 1MB 判定。
- `useAuth.tsx`: `signInWithOAuth({ provider, options: { redirectTo, queryParams: { prompt: "select_account" } } })`。

## 変更内容

### frontend のみ(backend は変更なし)

1. **`frontend/src/lib/server/ensure-oauth-user.ts`(新規)**: AikiNote から移植しつつ、spec.md の決定を反映。
   - `pickOAuthAvatarUrl(user)`: AikiNote と同じロジック(Appleのみのidentityは除外、`avatar_url`/`picture` を metadata → identity_data の順で探す、HEAD で 1MB 以下を確認)。
   - `ensureOAuthUser(user)`: `User` 行を `id` で検索し、あれば何もしない。無ければ **`id`/`email`/`username`/`profile_image_url` の4列のみ** INSERT。
   - **username の自動リトライ**(AikiNote に無い改善): email ローカル部を基底とし、`username` の一意性違反(Postgres `23505`)なら `base2`, `base3`... と最大5回リトライ。それでも失敗したら `base-<6桁ランダム>` で1回試す。全滅時は `logger` 相当(`console.error`)に残しつつ **例外を投げず** に return(ログイン自体は成立させる)。
   - 基底 username は `public."User".username` の制約(1〜20文字)に合わせて切り詰める。
2. **`frontend/src/app/auth/callback/route.ts`(新規)**: `[locale]` の外に置く。
   - `code` が無ければ `/login` へ。
   - `createServerClient`(anon + cookie 書き込み)で `exchangeCodeForSession`。失敗したら `/login?error=auth_error`。
   - 成功したら `ensureOAuthUser` を呼び、`/home` へリダイレクト。locale は `NEXT_LOCALE` cookie から復元し、`as-needed` に従って ja は prefix 無し・en は `/en` を付ける。
   - `0.0.0.0` → `localhost` の正規化は AikiNote から流用(ローカル開発で `next dev -H 0.0.0.0` を使っているため必要)。
3. **`frontend/src/lib/hooks/useAuth.tsx`**: `signInWithGoogle()` を追加。`getBaseUrl()` + `/auth/callback` を `redirectTo` に、`queryParams: { prompt: "select_account" }` を付ける。エラーは既存の `error` state に載せる。
4. **`frontend/src/components/features/auth/OAuthButtons/OAuthButtons.tsx`(新規)**: 「Googleで続ける」ボタン + 区切り線(「または」)。`components/features/auth/` 配下に1コンポーネント1ディレクトリで作る(`conventions.md` のディレクトリ配置)。CSS Modules。
   - Google のロゴは `@phosphor-icons/react` に無いため、**インラインSVG(公式のGoogle "G" マーク)** を使う。`conventions.md` は「PhosphorIcons統一・自作SVG不可」だが、これはブランドロゴであり例外(理由をコードコメントに残す)。
5. **`login/page.tsx` / `signup/page.tsx`**: `OAuthButtons` を配置する。
6. **翻訳(`ja.json` / `en.json`)**: `auth.oauth.google` / `auth.oauth.divider` / `auth.oauth.error` を追加(ja/en 同数)。

### テスト

7. **`ensure-oauth-user.test.ts`(新規)**: 既存行があれば INSERT しない / 無ければ4列で INSERT / username 衝突時にリトライして成功する / アバターが 1MB 超なら null。
8. **`OAuthButtons.test.tsx`(新規)**: ボタンが描画される / クリックで `signInWithGoogle` が呼ばれる。
9. `/auth/callback` の route handler テストは、`exchangeCodeForSession` のモックが重くなるため**今回は書かない**(AikiNote も `route.test.ts` を持つが、まずは上記2件で主要ロジックを担保する)。

## 実装順序

`ensure-oauth-user.ts` → そのテスト → `/auth/callback` → `useAuth` → `OAuthButtons` → ページ配置 → 翻訳 → テスト。

## リスクと対応

- **Redirect URL 未登録**: Supabase Dashboard に AikiBoard 分の Redirect URL が無いとコールバックが弾かれる。`specs/auth/open-questions.md` Q1。実装後の動作確認前にユーザーへリマインドする。
- **username の 20 文字制約**: email ローカル部が長い場合に備え、基底を切り詰めてからリトライのサフィックスを足す。
- **`getBaseUrl()` のサーバ/ブラウザ差**: `signInWithOAuth` はブラウザから呼ぶので `window.location.origin` が使われる。ローカルで `0.0.0.0` アクセスした場合に備え、callback 側で正規化する。
