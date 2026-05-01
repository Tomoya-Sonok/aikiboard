# AikiBoard

AikiBoard(アイキボード)は、合気道の道場・会などのコミュニティを運営する管理者向けの **道場管理＆コミュニケーションプラットフォーム** です。個人向け稽古日誌アプリ **AikiNote** の姉妹サービスとして、共通アカウント基盤のもとで連携します。

> **ステータス: 要件定義 FIX 済み・実装準備中**
>
> 要件定義ヒアリングは完了し、機能要件・技術選定・収益モデル・デザイン方針が確定しています。次のステップはリポジトリ初期化・基盤構築(Phase 0)です。

## ドキュメント

### 正式版(Primary)

- **要件定義書**: [`docs/requirements.md`](docs/requirements.md) — 実装チーム向けの仕様書
- **プロダクト概要**: [`docs/aikiboard-product-overview.md`](docs/aikiboard-product-overview.md) — ユーザー向け語り口調のガイド

### 開発ガイドライン

- [`CLAUDE.md`](CLAUDE.md) — Claude Code 用ガイドライン
- [`.agent/instructions.md`](.agent/instructions.md) — AI エージェント向け指示書

### 履歴・参考資料

- [`docs/draft/requirements.md`](docs/draft/requirements.md) — 初期叩き台(履歴保存)
- [`docs/draft/mock.tsx`](docs/draft/mock.tsx) — ビジュアルモック(React、Pencil 作業時の参考)

## 技術スタック(確定)

- **Frontend**: Next.js (App Router) / TypeScript / CSS Modules / next-intl / Zustand / TanStack Query / tRPC — Vercel にデプロイ
- **Backend**: Hono + tRPC on Cloudflare Workers(`api.aiki-board.com`)
- **DB/Auth**: Supabase(AikiNote と同一プロジェクト、`aikiboard` スキーマで論理分離)
- **決済**: Stripe + Stripe Invoice(Web 決済のみ)
- **監視**: Sentry / Axiom / BetterStack Uptime / Umami
- **リント/テスト**: Biome / Vitest
- **ドメイン**: Cloudflare Register(`aiki-board.com` 取得済み、2026-05-02)

詳細は [`docs/requirements.md`](docs/requirements.md) 10 章を参照。

## 関連プロジェクト

- [AikiNote](../aikinote) — 個人向け合気道稽古日誌アプリ(姉妹サービス)

## 次のステップ(Phase 0)

- [ ] `api.aiki-board.com` サブドメイン DNS 設定
- [ ] pnpm monorepo セットアップ(frontend / backend)
- [ ] Next.js / Hono 初期化
- [ ] Supabase `aikiboard` スキーマ作成・基本テーブル定義・RLS ポリシー適用
- [ ] Biome / Vitest / Husky セットアップ
- [ ] Vercel(Frontend)・Cloudflare Workers(Backend)のデプロイパイプライン
- [ ] ライセンス・CI バッジの追加

> 監視・分析(Sentry / Axiom / BetterStack / Umami)は本フェーズでは導入しない。

完了済み:

- [x] 要件定義 FIX(2026-04-15)
- [x] 技術スタック選定
- [x] ドキュメント雛形整備(CLAUDE.md / `.agent/` 配下)
- [x] 正式版 docs/requirements.md・docs/aikiboard-product-overview.md 執筆
- [x] GitHub リポジトリ初期化(git init + リモートリポジトリ接続済み)
- [x] `aiki-board.com` ドメイン取得(Cloudflare Register、2026-05-02)
