# oauth-login PRD

## 背景・目的

要件定義書5.1では「Apple/Google ソーシャルログイン優先、メール/パスワードはセカンダリ」としているが、実装は逆でメール/パスワードのみになっている。ターゲットである道場長・高齢層メンバーにとって、新規パスワードの管理は最大級の離脱要因である。またAikiNoteと共通アカウント基盤である以上、OAuthが揃って初めて「同じアカウントでそのまま使える」という約束が果たせる。

## 対象ユーザー

- 新規ユーザー(道場長・幹部・一般メンバーを問わず、これからAikiBoardを使い始める人)
- 既存のAikiNoteユーザー(同じアカウントでAikiBoardに入りたい人)

## ユーザーストーリー

- 新規ユーザーとして、パスワードを新しく考えて管理することなく、GoogleアカウントでAikiBoardを使い始めたい。
- 既存のAikiNoteユーザーとして、AikiNoteで使っているアカウントのままAikiBoardにログインしたい。
- 既存のメール/パスワードユーザーとして、これまで通りメール/パスワードでもログインできてほしい。

## 機能要件

### 必須

- ログイン画面・サインアップ画面に「Googleで続ける」ボタンを追加し、`supabase.auth.signInWithOAuth({ provider: "google", options: { redirectTo } })` を呼ぶ
- OAuthコールバックを受ける route handler(`/auth/callback`)を追加し、`exchangeCodeForSession` でセッションを確立してから `/home` へ遷移させる
- OAuth初回ログイン時に `public."User"` 行が無い場合、自動で作成する。**AikiNote の `frontend/src/lib/server/ensure-oauth-user.ts` に準拠**し、frontend の `/auth/callback` route handler から service_role で直接 INSERT する [Clarified: 2026-09-10 prd-refine]
- INSERT する列は **AikiBoard 既存の `POST /api/users` に合わせて `id` / `email` / `username` の3列 + `profile_image_url`**(OAuthアバター)とする。AikiNote が埋めている `publicity_setting` / `language` / `is_email_verified` / `password_hash` / `training_start_date` は埋めない [Clarified: 2026-09-10 prd-refine]
- username は email のローカル部から生成し、**衝突時は末尾に数字を付けて自動リトライ**する(`tomoya` → `tomoya2` → `tomoya3`)。AikiNote の実装は衝突対策が無くサイレント失敗するが、`docs/conventions.md` の「失敗を黙って飲み込まない」方針に合わせて改善する [Clarified: 2026-09-10 prd-refine]
- 既存のメール/パスワードログイン・サインアップは引き続き動作する
- ボタン文言は ja/en 両方に追加する

### 任意

- ~~「Appleで続ける」ボタン~~ → **今回のスコープ外**。Google のみ実装し、Apple は Services ID 設定が完了してから別PRで対応する [Clarified: 2026-09-10 prd-refine]。ボタン追加の仕組みは provider を差し替えれば足りる形にしておく

## 非機能要件

[TBD] 入力にパフォーマンス・アクセシビリティ等の具体的な要求は無い。既存のログイン画面と同水準とする想定だが未確認。

## 画面・API・データ

- 画面: `frontend/src/app/[locale]/(public)/login/page.tsx`、`.../signup/page.tsx`(既存、ボタン追加)、`/auth/callback`(新規 route handler)
- API: `POST /api/users`(既存。ただし下記「既存との差分」1 の通りそのままでは使えない)、`GET /api/users/:userId`(既存、存在判定に使う)
- データ: `public."User"`(AikiNoteと共有。OAuth初回ログイン時に行を作成する必要がある)

## スコープ外

- パスワードリセット/リカバリ機能(`specs/auth/spec.md` の未決事項。今回のOAuth追加とは別件)
- メール確認(verification)フローの見直し(現状 `email_confirm: true` でスキップしている)
- AikiNote側の変更(共通アカウント基盤の設定はSupabase Dashboard側の作業)

## 未決事項

- [TBD] Supabase Dashboard で Google provider が有効か、Redirect URLs に AikiBoard のURLが登録済みか(AikiNote が同じ Supabase プロジェクトで OAuth を実装済みのため provider 自体は有効な可能性が高いが、**Redirect URL は AikiBoard 分の追加が必要**。ユーザーの確認作業)(→ `specs/auth/open-questions.md` 参照)
- [Clarified: 2026-09-10] username 衝突時は自動リトライ(末尾に数字)で回避する
- [TBD] 既存のメール/パスワードアカウントと同じメールアドレスでGoogleログインした場合の挙動(Supabase の account linking 設定に依存)(→ `specs/auth/open-questions.md` 参照)
- [Clarified: 2026-09-10] Apple は今回のスコープ外(別PR)

## 変更履歴

| 日付 | 変更者 | 内容 |
|---|---|---|
| 2026-09-10 | Claude(`/prd`) | 初版作成 |

## 既存との差分

1. **`POST /api/users` は OAuth 経由では使えない**。現在の実装(`backend/src/routes/users/index.ts`)は `{email, password, username}` を必須とし、`supabase.auth.admin.createUser` で Auth ユーザーを作ってから `public."User"` に INSERT する2段階構成。OAuth では **Auth ユーザーは Supabase が既に作成済み**であり、必要なのは `public."User"` 行の INSERT のみ。→ **[Clarified] backend のエンドポイントは増やさず、AikiNote 同様に frontend の `/auth/callback` から service_role で直接 INSERT する**。結果として登録経路が2つ(メール/パスワード=backend API、OAuth=frontend route handler)になるが、これは AikiNote と同じ構造。
1-b. **AikiNote と AikiBoard で `public."User"` への INSERT 列が異なる**。AikiNote は11列(`publicity_setting` / `language` / `password_hash` 等)、AikiBoard は3列(`id`/`email`/`username`、「ローカルseedに合わせ」とコメント)。→ **[Clarified] AikiBoard 側の3列 + `profile_image_url` に揃える**(同一リポジトリ内で列セットが分岐するのを避けるため)。
1-c. **AikiNote の `ensureOAuthUser` は username 衝突時にサイレント失敗する**(`console.error` して return するため、ログインは成功するのにプロフィール行が無い状態になる)。→ **[Clarified] AikiBoard では自動リトライを追加**して回避する。
2. **`specs/auth/spec.md` の未決事項「メール確認フローが存在しない」との関係**: メール/パスワード登録は `email_confirm: true` で確認をスキップしている。OAuth ではメール確認が provider 側で行われるため、この論点は OAuth 経路には当てはまらない(既存経路の未決事項は残る)。
3. **`docs/ARCHITECTURE.md` 3.2 の認証フローに OAuth 経路が追加される**。現在は「ログインは `signInWithPassword` を直接呼ぶ(BFF非経由)」と記載されているが、OAuth も同様に BFF 非経由でブラウザから直接呼ぶ一方、**コールバック処理(`/auth/callback`)という新しい経路が増える**。実装後に ARCHITECTURE.md の該当節を更新する必要がある。
