# AikiBoard アーキテクチャ(as-is)

> **このドキュメントについて**
> - 作成日: 2026-09-07。作成方法: リポジトリのコード(`frontend/`, `backend/`, migrations, 設定ファイル)を実際に読み、確認できた事実のみを記述している。要件定義書・ロードマップ等の記述は参考にしたが、コードで裏取りできなかった内容は「不明」「[TBD]」と明記した。
> - **目的**: 実装済みコードの「現状(as-is)」を記録する。「あるべき姿(to-be)」は `docs/requirements.md` を参照。
> - **対象コミット**: `main` ブランチ、PR #113(`chore: spec-kit を導入`)マージ直後時点。
> - 推測で埋めていない箇所、複数スタイルが混在している箇所は本文中に明示している。

---

## 1. 技術スタックと主要ライブラリ

### 1.1 モノレポ構成

- パッケージマネージャ: **pnpm 8.15.4**(`packageManager` フィールドで固定、`pnpm-workspace.yaml` は `frontend` / `backend` の2パッケージ)
- ルート `package.json`(`aikiboard-monorepo`, version `1.0.0`): `dev`(`scripts/dev.mjs`)、`dev:stop`、`test`(`pnpm -r test`)、`check`(`pnpm -r check`)、`check:fix`、`prepare`(`husky`)。devDependencies は `husky ^9.1.7` のみ。
- ルート直下に `biome.json` は **存在しない**。lint/format設定は `frontend/biome.json` と `backend/biome.json` に個別配置。

### 1.2 フロントエンド(`frontend/`, `aikiboard-frontend` v0.1.0)

デプロイ先: Vercel(`https://aiki-board.com`)

| 領域 | ライブラリ | バージョン(package.json記載) |
|---|---|---|
| フレームワーク | `next` | `^16.2.2` |
| 言語 | `typescript` | `^5` |
| UI | `react` / `react-dom` | `^19.2.3` |
| API通信 | `@trpc/client` / `@trpc/react-query` / `@trpc/server` | `^11.16.0` |
| 状態管理(サーバ) | `@tanstack/react-query` | `^5.99.2` |
| 状態管理(クライアント) | `zustand` | `^5.0.12` |
| フォーム | `react-hook-form` | `^7.62.0` |
| バリデーション | `zod` | `^4.1.8` |
| フォーム⇔zod連携 | `@hookform/resolvers` | `^5.2.2` |
| i18n | `next-intl` | `^4.3.9` |
| Supabaseクライアント | `@supabase/supabase-js` / `@supabase/ssr` | `^2.39.8` / `^0.7.0` |
| リッチテキスト | `@tiptap/*`(core, react, extension-\* 各種) | `3`(全パッケージ統一) |
| アイコン | `@phosphor-icons/react` | `^2.1.10` |
| 日付 | `date-fns` | `^4.1.0` |
| ユーティリティ | `clsx` | `^2.1.1` |
| Lint/Format | `@biomejs/biome` | `^2.2.4` |
| テスト | `vitest` / `@testing-library/react` / `@testing-library/jest-dom` / `happy-dom` | `^3.2.4` / `^16.3.0` / `^6.8.0` / `^18.0.1` |
| Storybook | `storybook` / `@storybook/nextjs-vite` / `@storybook/addon-a11y` | `^9` |

スタイリングは **CSS Modules のみ**(TailwindCSS は不使用。package.json に該当依存なし、コード上も `.module.css` が標準)。

### 1.3 バックエンド(`backend/`, `aikiboard-backend` v0.1.0)

デプロイ先: Cloudflare Workers(`https://api.aiki-board.com`)

| 領域 | ライブラリ | バージョン |
|---|---|---|
| フレームワーク | `hono` | `^4.12.11` |
| Node実行用 | `@hono/node-server` | `^1.14.1` |
| バリデーション | `zod` / `@hono/zod-validator` | `^4.1.8` / `^0.7.2`(**後述: 実際は素のzodを手動呼び出し、`@hono/zod-validator` は依存にあるが未使用**) |
| DB/Auth | `@supabase/supabase-js` | `^2.49.4` |
| デプロイツール | `wrangler` | `^4.54.0` |
| ローカル実行 | `tsx` | `^4.19.3` |
| ローカルDB | `supabase`(CLI) | `^2.104.0` |
| Lint/Format | `@biomejs/biome` | `^2.2.4` |
| テスト | `vitest` / `happy-dom` | `^3.2.4` / `^18.0.1` |

**tRPC は使われていない**。backend は Hono による素の REST API(`app.route(prefix, subApp)`)。CLAUDE.md/要件定義書は「Hono + tRPC」と記載しているが、実装は tRPC 非依存の REST であり、tRPC 層は frontend 側にのみ存在する(1.4参照)。

### 1.4 DB・Auth・インフラ

- **Supabase**(PostgreSQL + Auth)。AikiNote と同一プロジェクトを `public`(AikiNote既存 + 共有)/ `aikiboard`(AikiBoard固有)のスキーマ分離で共有。
- ドメイン: `aiki-board.com`(フロント)/ `api.aiki-board.com`(バックエンド、Cloudflare Workers カスタムドメイン)。
- CI/CD: GitHub Actions(6章参照)。backend は `main` への push で自動デプロイ(`wrangler deploy`)。frontend は Vercel 側の自動デプロイ(設定ファイルはこのリポジトリには無く、Vercel側管理と推定。**未確認**)。

---

## 2. ディレクトリ構成と各ディレクトリの責務

```
aikiboard/
├── frontend/src/
│   ├── app/                    # Next.js App Router(ルーティング + tRPC HTTPハンドラ)
│   │   ├── [locale]/
│   │   │   ├── (public)/       # 未認証前提ページ(トップ/login/signup)。認証ガードなし
│   │   │   ├── (authenticated)/# 認証必須ページ(home/boards/new/invite/[token])。layout.tsxがServer Component guard
│   │   │   └── d/[slug]/       # ボード配下(共通シェル + 13機能ページ)。メンバー判定でシェル/公開ページを出し分け
│   │   └── api/trpc/[trpc]/    # tRPCのfetchハンドラ(Next.js自身がBFF)
│   ├── components/
│   │   ├── shared/              # 汎用UI(Button, Dialog, Input, Avatar, RichTextEditor等)
│   │   └── features/&lt;domain&gt;/   # 機能別コンポーネント(1コンポーネント1ディレクトリが基本)
│   ├── lib/
│   │   ├── trpc/                # tRPC vanillaクライアント
│   │   ├── supabase/            # Supabaseクライアント(browser/server/service-role)
│   │   ├── hooks/                # useAuth(唯一の共通hook)
│   │   ├── query/                # TanStack QueryProvider
│   │   ├── validation/           # zodスキーマファクトリ(auth等)
│   │   ├── i18n/                  # next-intlルーティング設定
│   │   ├── calendar/, recurrence/, feed/, archive/, boards/, utils/, types/  # 機能別ロジック
│   ├── server/trpc/
│   │   ├── routers/              # 15個のfeature別tRPCルーター(Hono APIへの1:1プロキシ)
│   │   └── hono.ts               # callHonoApi共通ラッパー、error.ts(HTTPステータス→tRPCコード変換)
│   ├── stores/                    # Zustand(uiStore.tsのみ、サイドバー開閉等UI状態限定)
│   ├── styles/                     # globals.css, variables.css(デザイントークン)
│   ├── translations/               # next-intl辞書(ja.json/en.json、423キーで完全一致)
│   └── proxy.ts                    # Next.js 16のmiddleware.ts代替。i18nルーティング+セッションcookie更新のみ(認可はしない)
├── backend/src/
│   ├── app.ts                      # Honoアプリ本体。ミドルウェア適用・15ルートのマウント
│   ├── index.node.ts / index.worker.ts  # ローカル/Workers用エントリーポイント
│   ├── routes/&lt;feature&gt;/index.ts  # 16機能ディレクトリ、各1ファイルにREST実装+テスト同居
│   ├── middleware/                  # auth.ts(JWT検証)、boardAccess.ts(認可の唯一の砦)、featureGuard.ts(プラン制御)
│   ├── lib/                          # jwt, supabase, logger, richtext, recurrence, activity, notifications, features, storage, aikinote, announcement-email
│   └── migrations/                   # 000〜016の3桁連番SQL(forward-only)。backend/supabase/migrationsはsymlink
├── docs/
│   ├── requirements.md              # 正式要件定義書(to-be、一部陳腐化箇所あり、7章参照)
│   ├── roadmap.md                    # 残タスク台帳(2026-07-04時点の横断調査結果)
│   ├── adr/                           # 開発フロー・アーキテクチャ・品質ゲート・環境戦略の意思決定記録(0001〜0004)
│   ├── design/                        # デザイントークン正典(02_tokens.css)・視覚リファレンス
│   └── aikiboard-product-overview.md # ユーザー向けプロダクト概要
├── .specify/, .claude/skills/         # spec-kit(2026-09-07導入、本ドキュメントとは独立)
├── .agent/                             # AIエージェント運用ルール(gitignore対象、ローカル専用)
└── scripts/dev.mjs, dev-stop.mjs       # frontend/backend同時起動・停止スクリプト
```

---

## 3. フロントエンド/バックエンドの境界・通信方法・認証の流れ

### 3.1 全体構成: Next.jsがBFF、backendはtRPC非依存のREST

```
ブラウザ ─┬─ Server Component (SSR, getServerSupabase) ─── Supabase Auth/DB
          │
          └─ tRPC client (frontend/src/lib/trpc/client.ts)
                 │  POST/GET /api/trpc/[trpc]
                 ▼
          Next.js tRPC handler (frontend/src/app/api/trpc/[trpc]/route.ts)
                 │  procedure実行 (frontend/src/server/trpc/routers/*.ts)
                 │  callHonoApi() で fetch
                 ▼
          Hono backend (api.aiki-board.com, backend/src/routes/*)
                 │  service_role で Supabase へ
                 ▼
          Supabase (aikiboard schema, RLSはバイパスされる)
```

- **tRPC procedure ↔ Hono endpoint は原則 1:1**(コード内コメントで明言、`frontend/src/server/trpc/routers/announcements.ts` 等)。frontendのtRPC層は独自のビジネスロジックをほぼ持たず、HTTPステータス→tRPCエラーコード変換(`frontend/src/server/trpc/error.ts`)が主な付加価値。
- `@trpc/react-query` は依存関係にあるが、`trpc.xxx.useQuery()` のような生成フックは使われていない。実態は vanilla `createTRPCClient`(`httpBatchLink`)を各コンポーネントが TanStack Query の `queryFn`/`mutationFn` から手動で呼ぶパターン。
- `publicBoardsRouter`(公開ページ用)のみ `publicProcedure`(認証不要)。他は全て `authenticatedProcedure`(`users.create` のみサインアップ用に例外)。

### 3.2 認証の流れ

1. **サインアップ**: フロント `SignUpForm` → tRPC `users.create`(`publicProcedure`)→ Hono `POST /api/users`(認証不要)→ backend が `supabase.auth.admin.createUser`(`email_confirm: true`)+ `public."User"` へ INSERT を service_role で実行、失敗時は Auth ユーザーをロールバック削除 → 成功後フロントが `supabase.auth.signInWithPassword` で自動ログイン。
2. **ログイン**: フロント `LoginForm` → `supabase.auth.signInWithPassword` を**直接**呼ぶ(BFFを経由しない)。
3. **セッション管理**: `AuthProvider`(`frontend/src/lib/hooks/useAuth.tsx`)が `onAuthStateChange` を購読し、profile を tRPC `users.getUserInfo` 経由で取得。
4. **cookieの更新**: `frontend/src/proxy.ts`(Next.js 16の `middleware.ts` 代替)が毎リクエスト `supabase.auth.getSession()` を呼びトークンローテーションを行うが、**認可判断はしない**。
5. **認可ガード**: `(authenticated)/layout.tsx`(Server Component)が未認証を `/login` へ redirect。ボード配下は各 `d/[slug]/*/page.tsx` が `requireBoardMember()` を呼ぶパターンで統一。**統一されたミドルウェアガードではなく、ページ/layoutへの分散実装**。
6. **backend側の検証**: `authMiddleware`(`backend/src/middleware/auth.ts`)が `Authorization: Bearer` の Supabase access_token を検証。`backend/src/lib/jwt.ts` が JWT の `alg` ヘッダで分岐: `ES256/RS256` は Supabase JWKS エンドポイントから取得した鍵で検証(本線、10分TTLキャッシュ)、`HS***` は `SUPABASE_JWT_SECRET` で検証(レガシーフォールバック)。
7. **認可(ロール判定)**: `backend/src/middleware/boardAccess.ts` の `createBoardGuard()` が `board_members` テーブルを service_role で直接参照し `owner/admin/member` を判定。**backendは常にservice_roleで動作しRLSを完全バイパスするため、このミドルウェアが認可の唯一の砦**であるとコード内コメントで繰り返し明言されている。RLSは frontend が anon key で直接 aikiboard スキーマへアクセスする経路(現状の使用有無は未確認)向けの二重防御という位置づけ。

**不明点**: SSR側(Server Component)とCSR側(`AuthProvider`)は、それぞれ独立して Supabase セッションを取得しており、明示的な状態受け渡し機構(SSRで取得したuserをpropsでClient Componentへ渡す等)は確認できていない。

---

## 4. データモデル(`aikiboard` スキーマ、migrations 000〜016)

`backend/src/migrations/*.sql` から復元したテーブル一覧。`public` スキーマ(`User`, `DojoStyleMaster` 等)は AikiNote 管理でこのリポジトリでは変更しない。

| テーブル | 概要 | 主なリレーション |
|---|---|---|
| `boards` | ボード本体。`slug`一意、`is_public` | `created_by_user_id` → `public."User"`(**FK制約なし、UUID型のみ**) |
| `board_settings` | ボード1:1設定(ロゴ/テーマ色/説明/`public_page_config` JSONB) | `board_id` → `boards`(1:1) |
| `board_members` | `(board_id,user_id)`複合PK、`role` enum(owner/admin/member) | owner1名限定のUNIQUE INDEX |
| `board_dojo_masters` | ボード×`DojoStyleMaster`のN:M、`is_primary`は1件限定 | `board_id` → `boards`、`dojo_master_id` → `public."DojoStyleMaster"`(FKなし) |
| `invitations` | 招待リンク。012で単一使用→共有リンク型(`revoked_at`+`label`)に変更 | `board_id` → `boards` |
| `membership_requests` | AikiNote道場からの参加申請(pending/approved/rejected)、013で新設 | `board_id` → `boards` |
| `activity_logs` | 操作履歴(有料機能)。`action`/`target_type`/`target_id`/`metadata` JSON | `board_id` → `boards` |
| `events` | 稽古(シリーズ1行)。`recurrence_rule`(RRULEテキスト)、`start_at&lt;end_at`のCHECK制約 | `board_id` → `boards` |
| `event_rsvps` | 出欠。010で`(event_id, occurrence_start, user_id)`複合PKへ再構成 | `event_id` → `events` |
| `event_overrides` | 定期稽古の「この回だけ」休講/上書き例外。010で新設 | `event_id` → `events`、`(event_id,occurrence_start)`一意 |
| `announcements` | お知らせ。`body_rich` JSONB、`published_at`で下書き/公開を判定 | `board_id` → `boards` |
| `announcement_reads` | 既読管理。`(announcement_id,user_id)`複合PK | `announcement_id` → `announcements` |
| `board_posts` | 道場内フィード投稿。`synced_from_post_id`/`cross_post_to_aikinote`でAikiNote連携 | `board_id` → `boards`、`synced_from_post_id` → `public."SocialPost"`(FKなし、コメントで将来追加予定と明記) |
| `board_post_attachments` | 投稿添付(image/video enum) | `post_id` → `board_posts` |
| `threads` | 投稿へのフラット1階層スレッド返信 | `post_id` → `board_posts` |
| `archives` | 階層ページ(自己FK`parent_id`)、有料機能 | `board_id` → `boards`、`parent_id` → `archives`(自己参照、CASCADE) |
| `archive_attachments` | アーカイブ添付(image/video/**aikinote_page**enum、`aikinote_page`は列のみ確保で未実装) | `archive_id` → `archives` |
| `member_fees` | メンバー別月謝。`effective_from`で履歴管理 | `board_id` → `boards` |
| `fee_payments` | 月謝支払ステータス(paid/unpaid/waived)、`period_yyyymm` | `board_id` → `boards` |
| `expense_entries` | 支出記録。`category`はフリーテキスト(固定選択肢化はされていない) | `board_id` → `boards` |
| `plans` | プラン定義(free/mini/standard)。Stripe連携カラムは未使用(NULL許容) | — |
| `features` | 機能定義(calendar/announcements/feed/members/public_page/multi_board/archive/accounting/activity_log/board_theme) | — |
| `plan_features` | プラン×機能N:M | `plan_id` → `plans` |
| `board_subscriptions` | ボードごとの契約状態(trialing/active/past_due/canceled) | `board_id` → `boards`、`plan_id` → `plans` |
| `notifications` | アプリ内通知。015で新設 | `board_id` → `boards`、`recipient_user_id` → `public."User"`(FKなし) |
| `board_todos` | ボード運営Todo(owner/admin限定)。016で新設、`order_index`列は未使用のまま確保 | `board_id` → `boards`、`assignee_user_id` → `public."User"`(FKなし) |
| Storage `board-media` | 非公開バケット。100MB上限、image/video系MIMEのみ許可。014で作成 | prefix で `feed/<boardId>/`, `archive/<boardId>/` を分離 |

**重要な設計方針**: `public."User"` / `public."DojoStyleMaster"` / `public."SocialPost"` への参照カラムは、型・引用符付き識別子の差異による apply 失敗を避けるため**意図的にFK制約を付与していない**(migrationコメントに明記)。Phase 1でのALTER TABLE追加が想定されていたが、`016` までの時点で追加されたかは確認できない([TBD])。

**RLS**: `008_apply_rls.sql` を基本に `010/011/013/015/016` で追加・修正。ヘルパ関数 `is_member_of_board`/`is_admin_or_owner_of_board`/`is_owner_of_board`/`is_board_public`(すべて `SECURITY DEFINER`)。基本方針は SELECT=メンバー、WRITE=owner/admin。`boards`/`board_settings`/`events`(is_public時)のみ `anon` に公開ボード限定でSELECT許可。`service_role` はRLSバイパスのため `009` で明示的にテーブル権限を付与。

---

## 5. 暗黙のルール(コードから読み取れる規約。複数スタイル混在は両方明記)

### 5.1 命名規則

- **ファイル名**: backendは kebab-case(`board-posts`, `dojo-masters`)、frontendコンポーネントは PascalCase(`BoardShell.tsx`)、util/lib は camelCase。
- **TS変数/関数**: camelCase。**型/interface**: PascalCase(`AppBindings`, `BoardRole`, `FeedPost`)。**定数**: SCREAMING_SNAKE_CASE(`DEFAULT_LIMIT`, `MAX_ITERATIONS`)。
- **DBカラム/テーブル**: snake_case。JS側でDTOに詰め替える際 camelCase へマッピング(`boardId: row.board_id`)するのが全ルート共通パターン。
- **Enum的な文字列リテラル型**: PascalCaseでなく小文字文字列(`"owner"|"admin"|"member"`)。DB側もPostgres ENUMで同じ文字列。

### 5.2 コンポーネント配置(混在あり)

- 標準: `components/features/&lt;domain&gt;/&lt;ComponentName&gt;/` に `.tsx` + `.module.css` + 任意で `.test.tsx` + `.stories.tsx` の4点セット(例: `Dialog/`, `BoardCreateForm/`)。
- **例外1**: `components/features/boards/dashboard/` は `DashboardCards.tsx`/`AnnouncementsCard.tsx`/`NextPracticeCard.tsx` の3コンポーネントが1ディレクトリに同居し、CSS Moduleも1つを共有。
- **例外2**: `components/features/auth/LoginForm/`・`SignUpForm/` は専用CSS Moduleを持たず、親ディレクトリ直下の共有ファイル `authForm.module.css` を相対importする(命名規則から意図的に外れる共有スタイル)。

### 5.3 エラーハンドリング(2パターン混在)

- **backend**: 共通エラークラス無し。全ルートで `if (error) { logger.error(...); return c.json({success:false,error:"..."}, status) }` パターンを個別に書く。`parseJson` ヘルパーが**ほぼ同一の実装として9ファイル以上に個別コピー**されている(共通化されていない)。
- **frontend**: ミューテーション(書き込み)は「`try/catch` + ローカル `useState` でエラーメッセージ保持 → `role="alert"` の `&lt;p&gt;` 表示」パターンがフォーム系コンポーネント多数で反復(共通化されていない)。**一方、クエリ(一覧・詳細取得)の失敗はほとんどのfeatureビューで専用のエラー表示が無く、`data?.data ?? []` で静かに空表示にフォールバックする**(`InviteJoin.tsx` の `isError` 使用のみが例外)。つまり「書き込み失敗は表示されるが、読み込み失敗は表示されない」という非対称な実態。

### 5.4 状態管理

- **Zustand**: `frontend/src/stores/uiStore.ts` の1ファイルのみ(サイドバー開閉・モバイルナビ開閉)。「アクティブボードはURLで表現する方針のためstoreに持たない」という設計意図がコメントに明記。
- **TanStack Query**: `staleTime: 60_000`, `retry: 1`, `refetchOnWindowFocus: false` で全体統一。**queryKeyは `[リソース名, boardId, サブ種別, ...]` という配列パターンが多数派だが、一元管理する共通ファクトリは存在せず、各コンポーネントが個別にリテラル配列を書いている**(例外: `AnnouncementDetailModal.tsx` のみローカルなkeyファクトリ関数を持つ)。ミューテーション成功後は `invalidateQueries({queryKey:[リソース名, boardId]})` という前方一致的な粗い無効化が主流。

### 5.5 APIレスポンス形式(混在あり)

backend共通で `{success: true, data: ...}` / `{success: false, error: string, code?: string}` の形は徹底されているが、**一覧系のページネーション形式が機能ごとに不統一**:
- `{data: {items:[...], total, limit, offset}}` 型: `activity-logs`, `notifications`, `announcements`一覧, `board-posts`一覧
- `{data: [...]}` 型(total/limit/offset無し): `boards`一覧, `members`一覧, `invitations`一覧, `board-todos`一覧

### 5.6 認可パターン

`backend/src/middleware/boardAccess.ts` の `createBoardGuard(level, idTable)` ファクトリから機能ごとのミドルウェアを生成する一貫パターン(`boardMemberMiddleware`, `boardAdminMiddleware`, `archiveAdminMiddleware` 等)。非メンバーには一律404を返し「ボードの存在自体を隠す」という設計方針が複数箇所のコメントで明言されている。有料機能は追加で `requireFeature(code)`(`backend/src/middleware/featureGuard.ts`)を後段に噛ませる。**Todo・ボード設定にはこのfeature_flagガードが存在しない**(未実装機能というより、無料機能として意図的に対象外にしていると読める。設定画面はコードコメントで「将来requireFeatureで絞る余地を残す」と明記)。

### 5.7 DBアクセス

`supabase.schema("aikiboard").from(table)`(aikiboard固有テーブル)と `supabase.from("User")`(public共有テーブル、schema省略)を都度使い分ける。1トランザクションにできない制約(supabase-jsはHTTPリクエスト単位)への対応として、`boards`作成・`board_posts`添付保存で「失敗したら直前の作成行をdeleteでロールバック」という手動補償パターンが使われている。

---

## 6. テスト・Lint・フォーマッタ・CIの現状

### 6.1 テスト

- **単体テスト**(Vitest, happy-dom環境): backend 23ファイル約210ケース、frontend 24ファイル約86ケース。`pnpm test:ci`(`vitest run --silent --passWithNoTests`)。
- **統合テスト**(backendのみ): `*.integration.test.ts` 5ファイル(announcements/boards/events/members/membership-requests のRLS検証)。ローカルSupabase(Docker)必須、環境変数が無ければ `describe.skip` で自動スキップ。**CI実行対象外**(`vitest.config.ts` の `exclude` で最初から除外)。
- **AAAパターン・「ユーザーアクションを伴う仕様のみテスト」という規約**(CLAUDE.md記載)は、テストケース数から見る限り概ね踏襲されているように見えるが、全ファイルの内容までは本調査で精査していない([TBD])。
- **フロントのテストカバレッジには偏りがある**: `components/features` 配下39ディレクトリ中、テストがあるのは18程度、Storybook storyがあるのは11のみ(`TodoView`/`FeedView`/`MembersView`/`FinanceView`等の大型ビューコンポーネントにstoryは無い)。

### 6.2 Lint / Formatter

- **Biome**(`^2.2.4`、スキーマ`2.4.13`)を frontend/backend 個別設定で使用。共に `linter.rules.recommended: true` + `style.useImportType: "off"`。フォーマットはスペース2幅・ダブルクォート・末尾カンマ`all`で統一。

### 6.3 Git hooks

- `.husky/pre-commit`: `pnpm -r check`(Biome + tsc、**全ファイル対象のフル実行**)。
- `.husky/pre-push`: `pnpm -r build` → `pnpm -r test:ci`。
- **lint-staged は未導入**(ADR 0003・要件定義書・CLAUDE.mdはHusky+lint-stagedの導入を明記しているが、設定ファイル・依存関係とも存在しない。7章参照)。

### 6.4 CI(GitHub Actions、`.github/workflows/`)

| ワークフロー | トリガー | 内容 |
|---|---|---|
| `frontend_ci.yml` | push/PR(main、frontend関連パス)、workflow_call | install → `verify:env:production` → `check` → `build` → `test:ci` |
| `backend_ci.yml` | 同上(backend関連パス) | install → `check` → `build`(`tsc --noEmit`)→ `test:ci` |
| `backend_deploy.yml` | push(main、backend変更)、workflow_dispatch | install → 型チェック → `wrangler deploy` |
| `deploy_storybook.yml` | push(main、frontend変更) | `build-storybook` → GitHub Pages |

**不整合**: `frontend_ci.yml`/`backend_ci.yml` は `workflow_call` トリガーを持つが、それを呼び出す親ワークフローが `.github/workflows/` 内に存在しない(push/pull_requestトリガーで独立動作するため実害はないが、設計意図が不明な残骸)。

### 6.5 ブランチ保護・マージ運用

GitHub Repository Ruleset(`main` ブランチ)で `deletion`禁止・`non_fast_forward`(force push)禁止・`required_approving_review_count: 0` を確認。**ADR 0001が明記する「required status checks(CI必須)」は設定されていない**(development-guide.md側もこの乖離を自覚的に記載済み)。**「squash and merge を強制」も未実装**(`allow_merge_commit`/`allow_rebase_merge`/`allow_squash_merge` が全てtrue)。実際の運用は `git log --merges` 上、PR #1〜#78頃はsquash、PR #88以降はmerge commitを使うよう変化しており、roadmap.mdに「スタックPRの連鎖コンフリクト回避のため」と運用変更の記録があるが、**ADR 0001自体への追補はまだ行われていない**。

---

## 7. 未完成・TODO・不整合とみられる箇所の一覧

### 7.1 明示的なTODO/暫定コメント(コード直接検索)

- `backend/src/migrations/007_create_feature_flag_tables.sql:77` — 「料金は要件定義6.1の暫定値」
- `backend/src/migrations/014_create_board_media_bucket.sql:23` — 「100MB(動画も想定。MVPの暫定上限)」
- `backend/src/lib/features.ts:8` — 「決済(Stripe)未実装の現段階では、全ボードがFreeのため有料機能はロックされる(正しい挙動)」
- `frontend/src/app/[locale]/(authenticated)/boards/new/page.tsx:4` — 「成功で暫定的に/homeへ(ボードホーム/一覧は後続PR)」
- `frontend/src/app/[locale]/(public)/page.tsx:5` — 「トップページ(暫定)。本格的なLPはroadmap R3-1で実装予定」
- `frontend/src/components/features/events/CalendarMonth/CalendarMonth.module.css:365` — 「週・リストは未実装」
- `frontend/src/components/features/boards/BoardHeader/BoardHeader.tsx:26` — 検索・言語切替・アカウントボタンは「表示のみ(ダミー)。本実装は後続PR」

### 7.2 要件定義書にあるが実装が見当たらない機能

- ~~**アドミン任命・解除(ロール変更)**~~ → **2026-09-10 実装済み**(PR #115、`PATCH /api/members/:userId/role`。`specs/members/spec.md` の「ロール変更の仕様」)。
- **オーナー譲渡**: `backend/src/routes/boards/index.ts` に該当エンドポイントなし。**未実装のまま**(roadmap R2-3、今回のスコープ外)。
- ~~**ボード削除**~~ → **2026-09-10 実装済み**(PR #115、`DELETE /api/boards/:id`。`specs/boards/spec.md` の「ボード削除の仕様」)。

要件定義書3.2の権限マトリクスのうち、残る未実装は**オーナー譲渡のみ**。

### 7.3 列・型は確保されているが未実装の機能

- `archive_attachments.attachment_type` の `aikinote_page` enum値 — 列は確保、`backend/src/routes/archives/index.ts` で明示的に読み書きから除外。
- `board_todos.order_index` 列 — 確保済みだが並べ替えUIなし、常に`0`挿入。
- `events`シリーズの個々のoccurrenceへの完全detach — 未実装。

### 7.4 バックエンドに実装があるがAikiBoard内で呼び出し元が無いAPI

- `GET /api/membership-requests/discoverable`, `GET /api/membership-requests/mine` — 要件定義書で「AikiNote側に導線を設ける」と明記されており、AikiBoard側フロントには対応UIが無い(意図的な設計だが、単体リポジトリとしては「呼び出し元のない公開API」)。
- `notifications.remove`(1件削除) — backend/tRPC両方に実装があるが `NotificationBell.tsx` に削除UIが無い。

### 7.5 ドキュメントの陳腐化

- `docs/requirements.md` 冒頭ヘッダが「v1.6・2026-06-04」のまま、改訂履歴はv2.7まで存在。
- `docs/requirements.md` 9.2「デザインツール: Pencil」の記載 — 実際は `docs/design/02_tokens.css` ベースのClaude Design運用に移行済み。
- `docs/development-guide.md` の「マイグレーション000-010」「23テーブル」表記 — 実際は`016`まで、テーブル数はより多い。

### 7.6 品質基盤の不整合(6章と重複するがまとめて再掲)

- lint-staged未導入(ADR 0003 C-9 未着手)。
- squash-merge強制のADR記載と実際のGitHub設定の不一致(ADR未追補)。
- `frontend_ci.yml`/`backend_ci.yml` の `workflow_call` の呼び出し元が存在しない。

### 7.7 意図が読み取れない設計判断([TBD]、機能グループ調査からの主要抜粋)

- サインアップ時 `email_confirm: true` でメール確認フローが無い理由。パスワードリセット機能の有無。
- ボード作成後に道場マスタの紐付けを変更する導線が無い(単一選択のみ、複数紐付けAPIはあるがUIなし)。
- 未承認道場(`is_approved: false`)の承認フロー(誰が・どこで)がこのリポジトリ内に見当たらない。
- `board-settings` のコードコメントは「テーマ・公開ページは将来有料化」を示唆するが、`plan_features` のseedデータは両方Freeプランに割り当て済みで矛盾している。
- アクティビティログの対象が announcement/event/post/rsvp/member の5系統に限定され、アーカイブ・会計・Todo・設定の変更は記録されない理由。

---

## 8. 参考: 本ドキュメントの調査方法

本ドキュメントは以下の観点でコードベースを分担調査し、統合した。
1. バックエンド構造(ルーティング・認証・DB・エラー処理・マイグレーション)
2. フロントエンド構造(App Router・状態管理・コンポーネント設計・i18n・テスト)
3. 品質基盤(CI・Git hooks・ADR/要件定義書とコードの整合性)
4〜7. 実装済み機能ごとの詳細(`specs/` 配下、9章参照)

## 9. specs/ 配下の機能一覧

機能の切り方とその理由は各 `spec.md` 末尾に記載しているが、共通する方針は以下の通り:

**切り方の原則**: `backend/src/routes/&lt;name&gt;` と `frontend/src/components/features/&lt;name&gt;` のディレクトリ境界が実装上ほぼ1:1で対応しており、この既存の実装境界(専用ルート・専用APIルーター・専用DBテーブル群)をそのまま機能単位として採用した。これにより「実装から機能を切り出す」という本タスクの性質上、恣意的な粒度判断を避け、検証可能な境界(コード上のディレクトリ・ファイル)に沿わせている。

| feature | 概要 | spec.md |
|---|---|---|
| auth | 認証(ログイン・サインアップ・セッション) | [`specs/auth/spec.md`](../specs/auth/spec.md) |
| boards | ボード作成・ダッシュボード・共通シェル | [`specs/boards/spec.md`](../specs/boards/spec.md) |
| dojo-masters | 道場マスタ双方向連携 | [`specs/dojo-masters/spec.md`](../specs/dojo-masters/spec.md) |
| public | 公開ページ(未認証アクセス) | [`specs/public/spec.md`](../specs/public/spec.md) |
| events | 稽古カレンダー+出欠管理 | [`specs/events/spec.md`](../specs/events/spec.md) |
| announcements | お知らせ配信 | [`specs/announcements/spec.md`](../specs/announcements/spec.md) |
| notifications | 通知(アプリ内) | [`specs/notifications/spec.md`](../specs/notifications/spec.md) |
| members | メンバー管理・招待・参加申請 | [`specs/members/spec.md`](../specs/members/spec.md) |
| feed | 道場内フィード+スレッド+AikiNote連携 | [`specs/feed/spec.md`](../specs/feed/spec.md) |
| activity | アクティビティログ | [`specs/activity/spec.md`](../specs/activity/spec.md) |
| archive | アーカイブ(階層ページ、有料) | [`specs/archive/spec.md`](../specs/archive/spec.md) |
| finance | 会計の見える化(有料) | [`specs/finance/spec.md`](../specs/finance/spec.md) |
| todo | ボードTodo | [`specs/todo/spec.md`](../specs/todo/spec.md) |
| settings | ボード設定(公開ページ設定含む) | [`specs/settings/spec.md`](../specs/settings/spec.md) |
