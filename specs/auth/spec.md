# 認証(ログイン・新規登録・セッション管理)

## 概要

Supabase Auth を用いたメール/パスワード認証。AikiBoard は AikiNote と同一 Supabase Auth + 共有 `public."User"` テーブルを使う(サインアップは backend が service_role 経由で Auth ユーザー作成と `public."User"` 行作成を同時に行う)。

## ユーザーストーリー(実装から読み取れるもの)

- 未登録ユーザーとして、メールアドレス・パスワードを入力し、続けてユーザー名を決めて新規登録したい(2ステップフォーム。`frontend/src/components/features/auth/SignUpForm/SignUpForm.tsx`)。
- 登録済みユーザーとして、メールアドレスとパスワードでログインし、ログイン後は自分のボードホームへ遷移したい(`frontend/src/app/[locale]/(public)/login/page.tsx`)。
- ログイン中のユーザーとして、明示的にログアウトしたい(`frontend/src/components/features/boards/BoardSidebar/BoardSidebar.tsx` の signOut ボタン)。
- 未認証で認証必須ページにアクセスした場合、ログインへ自動でリダイレクトされてほしい(`frontend/src/app/[locale]/(authenticated)/layout.tsx`)。

## 機能要件

- ✅ ログイン(email + password、`supabase.auth.signInWithPassword`)— `frontend/src/lib/hooks/useAuth.tsx`, `LoginForm.tsx`
- ✅ **Google OAuth ログイン**(PR #117 で実装、下記「OAuth ログインの仕様」参照)— `frontend/src/app/auth/callback/route.ts` と `frontend/src/lib/server/ensure-oauth-user.ts`
- ✅ サインアップ(2ステップ: 認証情報→ユーザー名。backend経由でAuthユーザー作成+`public."User"`profile作成、失敗時はAuthユーザーをロールバック)— `backend/src/routes/users/index.ts`
- ✅ サインアップ後は自動ログイン(作成直後に `signInWithPassword`)— `useAuth.tsx:147`
- ✅ email/username の重複チェック(サインアップ時、各々個別にエラーメッセージ)— `backend/src/routes/users/index.ts`
- ✅ パスワード強度バリデーション: 8〜128文字かつ大文字/小文字/数字/記号のうち3種以上 — `frontend/src/lib/validation/auth.ts`(`isStrongPassword`)
- ✅ ユーザー名バリデーション: 1〜20文字、半角英数字・ハイフン・アンダースコアのみ — `frontend/src/lib/validation/auth.ts`
- ✅ ログインフォームのパスワードは必須チェックのみ(強度検証なし、既存ユーザー向けのため)— `createLoginSchema`
- ✅ セッション管理: `AuthProvider`(Context)が `onAuthStateChange` を購読し、profile を BFF(tRPC `users.getUserInfo`)から取得。失敗時は session 情報のみでフォールバック — `useAuth.tsx`
- ✅ middleware(`proxy.ts`)で cookie 由来 session の更新・ローテーションを毎リクエスト実施 — `frontend/src/proxy.ts`
- ✅ 認証ガードは `(authenticated)` グループの Server Component layout で実施(未認証は `/login` へ redirect)— `frontend/src/app/[locale]/(authenticated)/layout.tsx`
- ✅ backend JWT検証ミドルウェア: alg で分岐(ES256→JWKS / HS256→SUPABASE_JWT_SECRET のフォールバック)、`payload.sub` を `userId` として設定 — `backend/src/middleware/auth.ts`, `backend/src/lib/jwt.ts`
- ✅ `GET /api/users/:userId` は本人のみ取得可(他人のIDを指定すると403)— `backend/src/routes/users/index.ts`
- ❓ サインアップは `email_confirm: true` で作成しており、メール確認(verification)フローが存在しない。意図的な最小実装か将来対応かはコードコメントのみで詳細不明 — `backend/src/routes/users/index.ts`
- ❓ パスワードリセット/リカバリ機能はコード上見当たらない(未実装か対象外か不明)

## 画面・API・テーブルの対応

- 画面: `/[locale]/login`(`LoginForm`)/ `/[locale]/signup`(`SignUpForm`)
- API:
  - `POST /api/users`(backend Hono、認証不要)= tRPC `users.create`
  - `GET /api/users/:userId`(backend Hono、認証必須)= tRPC `users.getUserInfo`
  - Supabase Auth 自体(`signInWithPassword`, `signOut`, `getSession`, `onAuthStateChange`, `auth.admin.createUser`)はフロント/バックエンドから直接呼び出し
- テーブル: `public."User"`(AikiNote側管理。`id/email/username/profile_image_url/dojo_style_id` 等の列を参照)

## 未決事項

- [TBD] `email_confirm: true` としてメール確認をスキップしている根拠(セキュリティ上の是非)は不明
- [TBD] パスワードリセット/変更フローの有無・仕様は不明(コードに実装なし)
- [TBD] サインアップの username 一意性チェックと Auth ユーザー作成の間に競合(race condition)が起きた場合の挙動は不明
- [Clarified: 2026-09-10] AikiNote と同一 Supabase プロジェクトの Auth を共有する。OAuth の実装は AikiNote(`frontend/src/lib/server/ensure-oauth-user.ts` と `app/auth/callback/route.ts`)に準拠する

## OAuth ログインの仕様

`docs/prd/oauth-login.md` で確定したスコープ(2026-09-10)。要件定義書5.1「Apple/Google 優先、メール/パスワードはセカンダリ」を満たすための機能。**今回は Google のみ**(Apple は Services ID 設定が完了してから別PR)。

### ユーザーストーリー

- 新規ユーザーとして、パスワードを新しく考えて管理することなく、Google アカウントで AikiBoard を使い始めたい。
- 既存の AikiNote ユーザーとして、AikiNote で使っているアカウントのまま AikiBoard にログインしたい。
- 既存のメール/パスワードユーザーとして、これまで通りログインできてほしい。

### 機能要件

- ログイン画面・サインアップ画面に「Google で続ける」ボタンを置き、`supabase.auth.signInWithOAuth({ provider: "google", options: { redirectTo, queryParams: { prompt: "select_account" } } })` を呼ぶ。`prompt: "select_account"` は AikiNote に合わせ、既存 Google セッションでのサイレント認証を防ぐ。
- `redirectTo` は `getBaseUrl()`(`frontend/src/lib/utils/env.ts`、既存)を使って `${baseUrl}/auth/callback` を組み立てる。**ユーザー入力を受け付けない**(open redirect 防止)。
- `/auth/callback` を route handler として新設し、`exchangeCodeForSession(code)` でセッションを確立してから `/home` へ遷移させる(`/home` は既存のリゾルバがボードへ振り分ける)。`code` が無い場合・交換に失敗した場合は `/login?error=auth_error` へ戻す。
- **`public."User"` 行の自動作成**: セッション確立後、`id` で行の存在を確認し、無ければ作成する。AikiNote の `ensureOAuthUser` に準拠し、**frontend の route handler から service_role(`getServiceRoleSupabase()`、既存)で直接 INSERT** する(backend にエンドポイントを増やさない)。
  - INSERT する列は **`id` / `email` / `username` / `profile_image_url` の4列**。AikiNote が埋めている `publicity_setting` / `language` / `is_email_verified` / `password_hash` / `training_start_date` は埋めない(AikiBoard 既存の `POST /api/users` が3列のみでコメントに「ローカル seed に合わせ」と明記されているため、そちらに揃える)。
  - `username` は email のローカル部から生成する。**衝突した場合は末尾に数字を付けて自動リトライ**する(`tomoya` → `tomoya2` → `tomoya3`、上限を決めて超えたらランダムサフィックス)。AikiNote の実装は衝突対策が無くサイレント失敗するが、`docs/conventions.md` の「失敗を黙って飲み込まない」方針に合わせて改善する。
  - `profile_image_url` は OAuth プロバイダのアバターURL。AikiNote の `pickOAuthAvatarUrl` に準拠し、HEAD リクエストでサイズを確認して 1MB 以下のときのみ採用する。取得できなければ `null`。
- 既存のメール/パスワードのログイン・サインアップは一切変更しない。
- ボタン文言は ja/en 両方に追加する。

### 受け入れ条件

- 新規 Google アカウントでログインすると、`public."User"` 行が作られ、`/home` を経てボード作成画面(所属0件のため)に到達する。
- 既存の AikiNote ユーザーが Google ログインすると、`public."User"` 行は作られず(既存行を使う)、所属ボードがあればそのボードへ着地する。
- username が既存ユーザーと衝突する場合でも、自動リトライで行が作られログインが完了する。
- OAuth をキャンセル/失敗した場合、`/login?error=auth_error` に戻りエラーが表示される。
- メール/パスワードのログイン・サインアップが従来通り動く。

### スコープ外

- Apple ログイン(Services ID 設定が完了してから別PR)
- パスワードリセット/リカバリ、メール確認フローの見直し(既存の未決事項のまま)
- 招待リンクからの復帰(`returnTo`)。AikiNote は cookie で実装しているが、AikiBoard では roadmap R3-4 として別タスク

## この粒度で切った理由

`backend/src/routes/users/*` という専用ルートと `frontend/src/components/features/auth/*` という専用ディレクトリを持ち、「本人確認」という単一の関心事に閉じているため独立した機能として切り出した。ボード作成([boards](../boards/spec.md))以降の全機能はこの認証状態を前提にしており、機能的な依存順序の起点となる。
