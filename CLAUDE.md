# CLAUDE.md

このファイルは Claude Code（claude.ai/code）が aikiboard リポジトリで作業する際のガイドラインを提供します。

> **ステータス: Phase 1(MVP 開発)進行中(2026-06-03〜)— 第1機能「認証 + 3階層ロール + ボード作成」実装済み(#51〜#54)**
>
> リポジトリ初期化と基盤構築(Phase 0、2026-05-05 完了)に続き、Phase 1 で **認証(サインアップ/ログイン・Server Component ガード)・tRPC 基盤・ボード作成(owner 登録 + 道場紐付け)** を実装。フロントエンドは Vercel(`https://aiki-board.com`)、バックエンドは Cloudflare Workers(`https://api.aiki-board.com`)で稼働、Supabase の `aikiboard` スキーマ + RLS 適用済み(REST 公開 + service_role 権限付与済み)。開発は **PR ベース運用**(main 直 push 禁止・squash merge)、運用方針は `docs/adr/`。次は ボードダッシュボード/画面導線 → 稽古カレンダー等。
>
> - 正式版要件定義書: [`docs/requirements.md`](docs/requirements.md)
> - 開発者向けガイド(セットアップ / ローカル Supabase / PR 運用): [`docs/development-guide.md`](docs/development-guide.md)
> - 運用方針 ADR(開発フロー・アーキテクチャ・品質ゲート・環境戦略): [`docs/adr/`](docs/adr/)
> - プロダクト概要(ユーザー向け): [`docs/aikiboard-product-overview.md`](docs/aikiboard-product-overview.md)
> - 初期叩き台(履歴): [`docs/draft/requirements.md`](docs/draft/requirements.md)
> - モック(ビジュアル参考): [`docs/draft/mock.tsx`](docs/draft/mock.tsx)
> - デザイン handoff: [`docs/design/`](docs/design/)(`02_tokens.css` がトークンの正、`claude_design_prototype.tsx` が 6 フレームの視覚リファレンス)

## セッション開始

セッション開始直後に `.agent/instructions.md` を1度だけ読み込み、その内容に従ってからユーザーの指示を待つこと。

## プロジェクト概要

AikiBoard は、合気道の道場・会などのコミュニティを運営する管理者向けの **道場管理＆コミュニケーションプラットフォーム** です。個人向け稽古日誌アプリ **AikiNote** の姉妹サービスとして、共通アカウント基盤のもとで連携します。

主軸は **管理者(オーナー・アドミン)の運営工数削減**。メンバーのコミュニティ体験向上も AikiNote 連携で同等に重視します。

### 主要コンセプト

- **3 階層ロール**: オーナー(道場長・会長、ボード1つにつき1名、課金責任者) / アドミン(幹部・事務局) / メンバー(一般道場生)
- **ボード単位**: 1 道場が複数ボード(子ども稽古/一般稽古、本部/支部 等)を作成可能。ただし AikiNote 道場マスタの既存道場を最低 1 件紐付け必須
- **公開ページ**: 集客チャネルとしての位置づけ(SEO・問い合わせ導線)
- **AikiNote 連携**: SSO(同一 Supabase Auth)、道場マスタ双方向書き込み、フィードのユーザー選択式クロスポスト、稽古日誌引用共有

### MVP 新規機能(ヒアリングで追加)

- **アーカイブ**: 管理者のみ、階層構造ページで稽古内容/議事録/演武会動画を長期保存(有料プラン)
- **会計の見える化**: ステータス管理 + 収支可視化(決済はオフライン前提、有料プラン)

詳細は [`docs/requirements.md`](docs/requirements.md) を参照。

## 主要コマンド

monorepo ルートで実行(AikiNote と同一方針):

| コマンド | 内容 |
|---|---|
| `pnpm dev` | frontend + backend を同時起動(`scripts/dev.mjs`) |
| `pnpm dev:stop` | バックグラウンド起動した dev サービスを停止 |
| `pnpm check` | Biome リント / フォーマットチェック(全パッケージ) |
| `pnpm check:fix` | リント / フォーマットの自動修正 |
| `pnpm test` | 全パッケージのテスト(Vitest) |

> 各パッケージ個別のコマンドは各 `package.json` を参照。lint-staged / Storybook 等の追加ツーリングは Phase 1 セットアップ([`docs/adr/0003`](docs/adr/0003-quality-gates.md))で順次導入する。

## 技術スタック

### フロントエンド (Vercel にデプロイ)

- **フレームワーク**: Next.js(App Router)
- **言語**: TypeScript
- **スタイリング**: **CSS Modules**(TailwindCSS は使用しない)
- **国際化**: `next-intl`(日英)
- **状態管理**: Zustand + TanStack Query
- **API 通信**: tRPC
- **アイコン(候補)**: `@phosphor-icons/react`(AikiNote と同様)

### バックエンド (Cloudflare Workers にデプロイ)

- **フレームワーク**: Hono + tRPC
- **API ドメイン**: `api.aiki-board.com`
- **AikiBoard Worker は AikiNote Worker とは別インスタンスで新規作成**

### DB・Auth

- **Supabase**(PostgreSQL + Auth)
- **AikiNote と同一 Supabase プロジェクト、スキーマ分離**:
  - `public`: AikiNote 既存 + 共通テーブル(`users`, `DojoStyleMaster` 等、変更しない)
  - `aikiboard`: AikiBoard 固有テーブルすべて
- **RLS**: `aikiboard` 全テーブル適用(`board_members` JOIN で所属メンバー判定、公開設定 ON のボードは `events` / `board_settings` のみ未認証 READ 許可)
- 認証は Apple / Google ソーシャルログイン優先、メール/パスワードはセカンダリ(AikiNote と統一)

### インフラ

- **レジストラ**: Cloudflare Register
- **ドメイン**: `aiki-board.com`(取得済み、2026-05-02、Cloudflare Register)
- **公開ページ URL**: パス型 `aiki-board.com/d/<slug>`
- **監視・分析**: Sentry(エラー) / Axiom(ログ) / BetterStack Uptime(稼働) / Umami(分析、AikiNote と同じダッシュボード)

### 開発ツール

- **パッケージマネージャ**: pnpm
- **リント/フォーマッタ**: Biome(AikiNote と同一)
- **テスト**: Vitest(AikiNote と同一)

### リポジトリ戦略

- **別リポジトリ**(AikiNote と独立)
- Supabase 型定義は両リポジトリで各自生成(CLI で `public` + `aikiboard` 対象)
- 共通 UI / ユーティリティは初期はコピー許容、肥大化したら別パッケージ化検討
- `.agent/` ルール構造は両リポジトリで類似維持(AI エージェント開発フロー共通化の要)

### feature_flag 設計

プラン別機能制御は自前実装。`aikiboard` スキーマに以下 4 テーブル:

- `plans`(プラン定義、Stripe Product に対応)
- `features`(機能定義)
- `plan_features`(N:M 対応表)
- `board_subscriptions`(ボードごとの契約状態)

アプリ側で `hasFeature(boardId, 'archive')` で実行時判定。詳細は [`docs/requirements.md`](docs/requirements.md) 6.5・付録 A.6 を参照。

## アーキテクチャ概要

### Monorepo 構成(予定、Phase 0 で確定)

AikiNote と同様の pnpm monorepo(`frontend/` + `backend/`)を想定。

### SP・PC 対応方針

- **PC ファースト + レスポンシブ必須**
- 管理者は PC 利用が主、メンバーは PC/SP 両方
- デザイン考案・実装は PC 先行、SP も崩れない品質を担保
- 「管理ツールらしさ」として UI 要素は直線的・シャープな方向性

### API 通信

- フロントエンド → tRPC 経由で Hono バックエンド(`api.aiki-board.com`)を呼ぶ
- Supabase への読み書きはバックエンド経由(`SUPABASE_SERVICE_ROLE_KEY`、RLS バイパス)
- フロントエンド側から直接 Supabase にアクセスする場合は `SUPABASE_ANON_KEY` + RLS で防御

## コーディング規約

> 具体的な規約詳細(CSS 変数対応表、z-index 変数表、PWA standalone 対応、React 19/Next.js 16 固有パターン等)は **AikiNote の規約をベースに Phase 0(リポジトリ初期化)で策定** します。現段階では AikiNote の `CLAUDE.md` および `.agent/rules/02_project_knowledge.md` を参考とし、AikiBoard 固有の判断が必要な箇所はユーザー確認のうえで確定します。

### 汎用規約(先行確定)

- **命名規則**: React Component は `PascalCase`、Hooks は `useXxx`、Logic/Util は `camelCase`、Types は `PascalCase`
- **テスト方針**: 「ユーザーアクションを伴う仕様」を網羅的にテスト、「画面表示テスト」は基本不要。AAA パターン厳守(Arrange / Act / Assert)。DRY よりも「読んでわかる」を優先
- **Git コミット規約**: prefix 以外日本語、`feat/fix/chore/test/docs`(AikiNote と同一)

### 参照順序

1. 正式版要件定義書: [`docs/requirements.md`](docs/requirements.md)
2. 運用方針 ADR: [`docs/adr/`](docs/adr/)(開発フロー・アーキテクチャ・品質ゲート・環境戦略の意思決定記録)
3. プロダクト概要(ユーザー向け): [`docs/aikiboard-product-overview.md`](docs/aikiboard-product-overview.md)
4. エージェント指示書: [`.agent/instructions.md`](.agent/instructions.md) → `.agent/rules/*.md`

---

実装フェーズ(Phase 0)開始時に、本ファイルは AikiNote の `CLAUDE.md` と同等の詳細仕様(CSS 規約・z-index 管理・PWA 対応など)を追記していきます。
