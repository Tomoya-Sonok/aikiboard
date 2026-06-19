# AikiBoard

AikiBoard(アイキボード)は、合気道の道場・会などのコミュニティを運営する管理者向けの **道場管理＆コミュニケーションプラットフォーム** です。個人向け稽古日誌アプリ **AikiNote** の姉妹サービスとして、共通アカウント基盤のもとで連携します。

> **ステータス: Phase 1(MVP 開発)進行中**(最終更新: 2026-06-19)
>
> 基盤構築(Phase 0)に続き、Phase 1 で **認証 + 3 階層ロール + ボード作成・稽古カレンダー + 出欠管理・お知らせ配信・メンバー管理** を実装済み(SP レスポンシブ対応含む)。フロントエンドは [`https://aiki-board.com`](https://aiki-board.com)(Vercel)、バックエンド API は [`https://api.aiki-board.com`](https://api.aiki-board.com)(Cloudflare Workers)で稼働中。Supabase の `aikiboard` スキーマ + RLS 適用済み。開発は **PR ベース運用**(main 直 push 禁止・squash merge)、運用方針は [`docs/adr/`](docs/adr/)。次は **道場内フィード + スレッド** を予定。

## ドキュメント

### 正式版(Primary)

- **要件定義書**: [`docs/requirements.md`](docs/requirements.md) — 実装チーム向けの仕様書
- **プロダクト概要**: [`docs/aikiboard-product-overview.md`](docs/aikiboard-product-overview.md) — ユーザー向け語り口調のガイド

### 開発ガイドライン

- [`docs/development-guide.md`](docs/development-guide.md) — **開発者向け総合ガイド**(セットアップ・ローカル Supabase・環境変数・PR 運用・テスト)。リポジトリを触るならまずここから
- [`CLAUDE.md`](CLAUDE.md) — Claude Code / 開発者向けガイドライン
- [`docs/adr/`](docs/adr/) — 運用方針 ADR(開発フロー・アーキテクチャ・品質ゲート・環境戦略の意思決定記録)
- `.agent/instructions.md` — AI エージェント向け指示書(ローカル専用、`.gitignore` 対象でリポジトリには含まれません)

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

## Phase 1: MVP 開発(進行中)

開発基盤(PR ベース運用・[ADR](docs/adr/) 整備・ローカル Supabase・Storybook)を整備のうえ、MVP 機能を優先度順に実装中。

### 実装済み

- [x] **認証 + 3 階層ロール + ボード作成**(#51〜#54)— サインアップ/ログイン、Server Component ガード、JWKS(ES256)検証、owner 登録 + 道場紐付け、Free サブスク自動生成
- [x] **ログイン後ダッシュボード + 画面導線・シェル**(#58〜#63)— サイドバー(複数ボード切替)+ ヘッダー、最後に開いたボードへ直行
- [x] **稽古カレンダー + 出欠管理**(#64〜#67)— 月表示、定期稽古の RRULE 展開(Asia/Tokyo)、休講/上書き(例外)、参加/不参加表明・名簿・管理者集計、ダッシュボード「次の稽古」
- [x] **お知らせ配信**(#70〜#74)— 下書き→公開の 2 段階、Tiptap(WYSIWYG)本文、既読/未読バッジ、公開時の Resend メール一斉送信
- [x] **メンバー管理**(#75〜#80)— 一覧、共有招待リンク(`/invite/<token>`)、自主退会、管理者削除、AikiNote 道場からの参加申請(承認/却下。発見・申請の導線は AikiNote 側へ移管)
- [x] **複数道場切り替え UI**(サイドバーの Slack 風スイッチャ)
- [x] **SP レスポンシブ対応**(#81〜#84)— サイドバー→ハンバーガードロワー、モーダル→フルスクリーンシート、カレンダー SP 化、外側余白の一元化
- [x] **日英 i18n 基盤**(next-intl、主要画面のメッセージ整備)

### 未実装(残りの MVP 機能)

- [ ] **道場内フィード + スレッド(返信)+ AikiNote 引用共有・クロスポスト** ← 次の実装予定
- [ ] アクティビティログ(管理者向け操作履歴)
- [ ] 道場ページ(公開プロフィール、SEO・問い合わせ導線)+ 未認証の公開カレンダー閲覧
- [ ] アーカイブ(階層構造ページ・動画添付、有料)
- [ ] 会計の見える化(月謝ステータス + 収支可視化、有料)
- [ ] 道場マスタ双方向書き込み(AikiBoard から新規道場を追加、オーナーのみ)
- [ ] 通知基盤 + 本実装(フィード/スレッド等、MVP 後半)
- [ ] 決済(Stripe + Stripe Invoice、30 日無料トライアル)+ プラン別機能ゲート(feature_flag)の本実装
- [ ] PWA 対応

### 積み残し(細部・運用)

- [ ] メンバーの停止(suspend、現状は削除のみ)・招待リンクの QR コード生成
- [ ] お知らせメールの本番有効化(Resend ドメイン認証 + secret 登録、ユーザー作業)
- [ ] AikiNote 側の参加申請導線(aikinote リポジトリ Issue #329)

> 監視・分析(Sentry / Axiom / BetterStack / Umami)はユーザー判断で個別に導入する。Phase 1 開発の進捗を見て必要なタイミングで提案。
