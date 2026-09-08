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
- [TBD] SSO(AikiNoteとの同一Supabase Auth共有)の具体的なセッション共有の仕組みは今回の調査範囲では直接確認していない

## この粒度で切った理由

`backend/src/routes/users/*` という専用ルートと `frontend/src/components/features/auth/*` という専用ディレクトリを持ち、「本人確認」という単一の関心事に閉じているため独立した機能として切り出した。ボード作成([boards](../boards/spec.md))以降の全機能はこの認証状態を前提にしており、機能的な依存順序の起点となる。
