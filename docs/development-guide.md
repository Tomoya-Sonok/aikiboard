# AikiBoard 開発ガイド

AikiBoard リポジトリをローカルで開発するための実践ガイドです。**実際に手を動かす開発者向け**の手順・ルールをまとめています(AI エージェント向けのルールは `.agent/`、設計判断の背景は [`docs/adr/`](adr/) を参照)。

> 運用方針の「なぜ」は [ADR](adr/) に、機能仕様は [`requirements.md`](requirements.md) にあります。本ガイドは「どう動かすか / どう進めるか」の手順書です。

---

## 1. 前提ツール

| ツール | バージョン | 備考 |
|---|---|---|
| Node.js | 22.22.0 | [mise](https://mise.jdx.dev/) で管理(`.mise.toml`) |
| pnpm | 8.15.4 | 同上。`packageManager` 固定 |
| Docker Desktop | — | ローカル Supabase コンテナ用。起動しておくこと |

```bash
# mise を使う場合(推奨): リポジトリ直下で
mise install        # .mise.toml の node / pnpm を導入
```

---

## 2. 初回セットアップ

```bash
# 1. 依存インストール(リポジトリ直下)
pnpm install

# 2. 環境変数ファイルを作成(ルート 1 箇所。下記「4. 環境変数」参照)
cp .env.local.example .env.local

# 3. ローカル Supabase を起動(Docker Desktop が必要)
cd backend && pnpm exec supabase start

# 4. マイグレーションを適用(000_seed + 001-008)
pnpm exec supabase db reset

# 5. supabase status でローカルのキーを確認し、ルートの
#    .env.local の ANON/SECRET を埋める
pnpm exec supabase status
```

完了したら `pnpm dev`(リポジトリ直下)で frontend + backend が起動します。

---

## 3. 日常の開発コマンド

すべて**リポジトリ直下**で実行します。

| コマンド | 内容 |
|---|---|
| `pnpm dev` | frontend(http://localhost:3000)+ backend(http://localhost:8787)を同時起動 |
| `pnpm dev -- --bg` | バックグラウンド起動(ログは `logs/dev-*.log`) |
| `pnpm dev:stop` | バックグラウンド起動した dev を停止 |
| `pnpm check` | Biome リント/フォーマット + `tsc --noEmit`(全パッケージ) |
| `pnpm check:fix` | リント/フォーマットの自動修正 |
| `pnpm test` | 全パッケージのテスト(Vitest) |
| `cd frontend && pnpm sb` | Storybook 起動(http://localhost:6006) |

backend 単体で何かする場合は `pnpm -C backend <script>`、frontend は `pnpm -C frontend <script>`。

---

## 4. 環境変数

**env は[ルート直下の `.env.local` 1 箇所](../.env.local.example)だけ**で管理します。frontend / backend が両方ここを読みます:

- `frontend`(Next.js)— `next.config.mjs` が起動時に `../.env.local` を読み込む
- `backend`(Hono)— dev スクリプトが `cd .. && dotenv -e .env.local` でルートを読み込む
- ルートの [`.env.local.example`](../.env.local.example) がテンプレート。`cp .env.local.example .env.local` の 1 回だけでよい(frontend / backend に個別の `.env.local` は不要)

`.env.local` は `.gitignore` 済みで**絶対にコミットしない**(secret scanning にも引っかかります)。

### ローカル Supabase 用(通常の開発)

`.env.local` の `ANON`/`SECRET` を `pnpm exec supabase status` の値(Publishable / Secret key)で埋めます。URL は固定:

| 変数 | 値 |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` / `SUPABASE_URL` | `http://127.0.0.1:54321` |
| `NEXT_PUBLIC_API_URL` | `http://127.0.0.1:8787` |
| `NEXT_PUBLIC_APP_URL` | `http://127.0.0.1:3000` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `supabase status` の Publishable key |
| `SUPABASE_SERVICE_ROLE_KEY` | `supabase status` の Secret key |

### 本番 Supabase に繋ぐ場合(通常は不要)

`.env.local.example` の「本番 Supabase 用」ブロックを使い、Supabase Dashboard → Settings → API / Database の値を入れます。本番値は Vercel / Cloudflare Workers にも登録済みです。

---

## 5. ローカル Supabase

ローカルは Docker 上の Supabase コンテナで開発します(本番 DB には触れません)。詳細は [ADR 0004](adr/0004-environment-and-migration-strategy.md)。

```bash
cd backend
pnpm exec supabase start     # コンテナ起動(初回は Docker イメージ pull で数分)
pnpm exec supabase status    # URL・キー確認(API:54321 / DB:54322 / Studio:54323)
pnpm exec supabase db reset  # migrations(000-008)を頭から再適用
pnpm exec supabase stop      # コンテナ停止
```

- **Studio**: http://localhost:54323 で `aikiboard` schema(22 テーブル)を確認できる
- migration の実体は [`backend/src/migrations/`](../backend/src/migrations/)。`backend/supabase/migrations` はそこへの **symlink**(supabase CLI は `supabase/migrations` 固定のため)
- `000_seed_public_schema_for_local_dev.sql` は `public."User"` / `public."DojoStyleMaster"` の**ローカル専用ダミー**。**本番には絶対適用しない**
- 詳細・本番適用手順は [`backend/src/migrations/README.md`](../backend/src/migrations/README.md)

---

## 6. 開発フロー / PR 運用

PR ベース運用です(main 直 push は禁止、緊急 hotfix のみ例外)。詳細は [ADR 0001](adr/0001-development-flow-and-pr-operation.md)。

1. **ブランチを切る**: `feat/...` / `fix/...` / `chore/...` / `docs/...`(Issue 紐付けは `feat/#<issue>_...`)
2. **実装** → コミット: Conventional Commits prefix + **prefix 以外は日本語**(例: `feat: ボード作成フォームを追加`)
   - pre-commit で `pnpm -r check`(Biome + tsc)、pre-push で `pnpm -r build` + `pnpm -r test:ci` が自動実行される
3. **PR 作成**: [PR テンプレート](../.github/pull_request_template.md)のチェックリストを埋める
4. **CI**: `frontend_ci` / `backend_ci` が変更パッケージに応じて走る(両方とも `Production` environment で secrets を取得)
5. **self-review**: PR を立てて少し時間を置いてから自分で読み返す(approvals は 0)
6. **squash merge** + ブランチ自動削除

> branch protection(Ruleset)が有効: PR 必須・force push/deletion 制限。**required status checks は未設定**(CI は paths フィルタで skip されることがあり、required にするとマージ不可になるため)。

---

## 7. テスト

方針は [ADR 0003](adr/0003-quality-gates.md)。「ユーザーアクションを伴う仕様」を網羅し、AAA パターン(Arrange / Act / Assert)で書きます。

- **必須**: backend route handler / middleware / pure 関数、frontend hooks / utils
- **AikiBoard 固有**: RLS policy integration test(各ロール owner/admin/member/anon × 各 RLS)。ローカル Supabase を使う
- 機能 PR にテストを**同梱**する(書かない場合は PR に理由を明記)
- 実行: `pnpm test`(全体) / `pnpm -C backend test:ci`(backend のみ) など

---

## 8. Storybook

全コンポーネントに story を付けます(`*.stories.tsx`)。例外は Next.js 特殊ファイル(`page.tsx`/`layout.tsx` 等)と複雑な Server Component(PR に理由明記)。

```bash
cd frontend
pnpm sb               # ローカル起動(localhost:6006)
pnpm build-storybook  # 静的ビルド(storybook-static/)
```

- main に frontend 変更がマージされると `deploy_storybook.yml` が走り、**https://tomoya-sonok.github.io/aikiboard/** へ自動デプロイ
- `frontend/public/` は `.gitkeep` で保持(staticDirs 参照先。空ディレクトリは git に残らないため)

---

## 9. ディレクトリ構造

```
aikiboard/
├── frontend/                  # Next.js (App Router) — Vercel
│   ├── src/app/[locale]/      #   ルーティング((public)/(authenticated) で分離予定)
│   ├── src/components/
│   │   ├── features/<feature>/  # 機能別コンポーネント
│   │   └── shared/              # 共通コンポーネント(Atomic Design は使わない)
│   ├── src/lib/               #   hooks / supabase client / i18n 等
│   ├── src/server/trpc/       #   tRPC(BFF。feature 別 router。Phase 1 で作成)
│   ├── src/stores/            #   Zustand(永続 UI 設定)
│   └── .storybook/
├── backend/                   # Hono — Cloudflare Workers
│   ├── src/routes/<feature>/  #   /api/<feature>(Phase 1 で作成)
│   ├── src/middleware/        #   auth / boardMember / boardAdmin
│   ├── src/lib/               #   supabase / logger
│   ├── src/migrations/        #   SQL マイグレーション(3 桁連番)
│   └── supabase/              #   config.toml + migrations(symlink)
└── docs/                      # requirements / adr / design / 本ガイド
```

- 状態管理: Server state = TanStack Query + tRPC / Form = React Hook Form + Zod / 永続 UI = Zustand / Session = AuthProvider Context
- アクティブボードは **URL 駆動**(`/<locale>/d/<board-slug>/...`)。詳細は [ADR 0002](adr/0002-architecture-decisions.md)

---

## 10. デプロイ

- **frontend**: Vercel(main マージで自動。PR は preview デプロイ)
- **backend**: Cloudflare Workers。`cd backend && pnpm deploy`(`wrangler deploy`)
- **secrets**: Vercel / Cloudflare / GitHub(`Production` environment)に登録済み。新しい secret が必要なときは各所に追加
  - 例: Phase 1 認証で `SUPABASE_JWT_SECRET` を `cd backend && pnpm exec wrangler secret put SUPABASE_JWT_SECRET`

---

## 11. トラブルシュート

| 症状 | 対処 |
|---|---|
| `frontend check` が `.next/types/...` の型エラーで落ちる | 古い `.next` 残骸。`rm -rf frontend/.next && pnpm -C frontend build` で再生成 |
| `supabase start` が `Cannot connect to the Docker daemon` | Docker Desktop を起動する |
| CI で secrets が空(`verify:env:production` 失敗) | workflow の `environment: Production` 指定を確認(secrets は environment 配置) |
| `db reset` で migration が当たらない | `backend/supabase/migrations` の symlink が壊れていないか確認(`ls -la`) |
| dependabot PR が大量 | grouping 済み([`.github/dependabot.yml`](../.github/dependabot.yml))。minor/patch は 1 PR にまとまる |

---

## 関連ドキュメント

- [`docs/adr/`](adr/) — 運用方針 ADR(開発フロー / アーキテクチャ / 品質ゲート / 環境戦略)
- [`docs/requirements.md`](requirements.md) — 正式版要件定義書
- [`backend/src/migrations/README.md`](../backend/src/migrations/README.md) — マイグレーション詳細
- [`CLAUDE.md`](../CLAUDE.md) — Claude Code / AI エージェント向けガイドライン
