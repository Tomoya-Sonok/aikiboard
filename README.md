# AikiBoard

AikiBoard(アイキボード)は、合気道の道場・会などのコミュニティを運営する管理者向けの **道場管理＆コミュニケーションプラットフォーム** です。個人向け稽古日誌アプリ **AikiNote** の姉妹サービスとして、共通アカウント基盤のもとで連携します。

> **ステータス: Phase 0 完了 — MVP 開発準備中**(最終更新: 2026-05-05)
>
> リポジトリ初期化と基盤構築が完了しました。フロントエンドは [`https://aiki-board.com`](https://aiki-board.com)(Vercel)、バックエンド API は [`https://api.aiki-board.com`](https://api.aiki-board.com)(Cloudflare Workers)で稼働中。Supabase の `aikiboard` スキーマ + RLS も適用済み。次のステップは Phase 1(MVP 機能の実装)です。

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

## Phase 0 完了済み(2026-05-05)

- [x] 要件定義 FIX(2026-04-15)
- [x] 技術スタック選定
- [x] ドキュメント雛形整備(CLAUDE.md / `.agent/` 配下)
- [x] 正式版 docs/requirements.md・docs/aikiboard-product-overview.md 執筆
- [x] GitHub リポジトリ初期化(git init + リモートリポジトリ接続済み)
- [x] `aiki-board.com` ドメイン取得(Cloudflare Register、2026-05-02)
- [x] `api.aiki-board.com` サブドメイン DNS 設定(Cloudflare Workers Custom Domain)
- [x] pnpm monorepo セットアップ(frontend / backend)
- [x] Next.js 16 + React 19 frontend 初期化(Hello ページ + i18n + Vercel デプロイ)
- [x] Hono on Cloudflare Workers backend 初期化(`/health` 稼働)
- [x] Supabase `aikiboard` スキーマ作成・全 22 テーブル DDL・RLS ポリシー適用
- [x] Biome / Vitest / Husky セットアップ
- [x] Vercel(Frontend)・Cloudflare Workers(Backend)のデプロイパイプライン
- [x] GitHub Actions CI/CD(frontend_ci / backend_ci / backend_deploy)

## 次のステップ(Phase 1: MVP 開発)

- [ ] 認証(SSO、Apple / Google ソーシャルログイン経由)
- [ ] 3 階層ロール管理(オーナー / アドミン / メンバー)とボード作成フロー
- [ ] 稽古カレンダー + 出欠管理(🔴 最優先)
- [ ] お知らせ配信(管理者→メンバー、既読管理)
- [ ] 道場内フィード + スレッド + AikiNote 引用共有・クロスポスト
- [ ] メンバー管理(招待・退会・削除)
- [ ] アクティビティログ(有料)
- [ ] 道場ページ(公開、SEO・問い合わせ導線)
- [ ] アーカイブ(有料、階層構造ページ)
- [ ] 会計の見える化(有料、月謝ステータス + 収支可視化)
- [ ] 複数道場切り替え UI
- [ ] 通知基盤 + 本実装(MVP 後半)
- [ ] 決済(Stripe + Stripe Invoice、30 日無料トライアル)
- [ ] 日英 i18n の本実装
- [ ] PWA 対応
- [ ] ライセンス・CI バッジの追加(任意)

> 監視・分析(Sentry / Axiom / BetterStack / Umami)はユーザー判断で個別に導入する。Phase 1 開発の進捗を見て必要なタイミングで提案。
