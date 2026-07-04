# AikiBoard

AikiBoard(アイキボード)は、合気道の道場・会などのコミュニティを運営する管理者向けの **道場管理＆コミュニケーションプラットフォーム** です。個人向け稽古日誌アプリ **AikiNote** の姉妹サービスとして、共通アカウント基盤のもとで連携します。

> **ステータス: Phase 1(MVP)の主要機能が一巡**(最終更新: 2026-07-04)
>
> 基盤構築(Phase 0)に続き、Phase 1 で **認証・ボード作成からフィード・通知・アクティビティログ・公開ページ・アーカイブ・会計・Todo まで**(PR #51〜#99)を実装済み。フロントエンドは [`https://aiki-board.com`](https://aiki-board.com)(Vercel)、バックエンド API は [`https://api.aiki-board.com`](https://api.aiki-board.com)(Cloudflare Workers)で稼働中。Supabase の `aikiboard` スキーマ + RLS 適用済み。開発は **PR ベース運用**(main 直 push 禁止)、運用方針は [`docs/adr/`](docs/adr/)。次の残タスクと実装方針は **普及ロードマップ [`docs/roadmap.md`](docs/roadmap.md)** を参照。

## ドキュメント

### 正式版(Primary)

- **要件定義書**: [`docs/requirements.md`](docs/requirements.md) — 実装チーム向けの仕様書
- **プロダクト概要**: [`docs/aikiboard-product-overview.md`](docs/aikiboard-product-overview.md) — ユーザー向け語り口調のガイド
- **普及ロードマップ**: [`docs/roadmap.md`](docs/roadmap.md) — MVP 一巡後の残タスク台帳と実装方針(現在地はここが最新)

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

## Phase 1: MVP 開発(主要機能一巡)

開発基盤(PR ベース運用・[ADR](docs/adr/) 整備・ローカル Supabase・Storybook)を整備のうえ、MVP 機能を実装。

### 実装済み

- [x] **認証 + 3 階層ロール + ボード作成**(#51〜#54)— サインアップ/ログイン、JWKS(ES256)検証、owner 登録 + 道場紐付け、Free サブスク自動生成
- [x] **ログイン後ダッシュボード + シェル**(#58〜#63)— サイドバー(複数ボード切替)+ ヘッダー、最後に開いたボードへ直行
- [x] **稽古カレンダー + 出欠管理**(#64〜#67)— 月表示、定期稽古の RRULE 展開(Asia/Tokyo)、休講/上書き、出欠表明・名簿・管理者集計
- [x] **お知らせ配信**(#70〜#74)— 下書き→公開、Tiptap 本文、既読/未読バッジ、公開時の Resend メール一斉送信
- [x] **メンバー管理**(#75〜#80)— 一覧、共有招待リンク(`/invite/<token>`)、自主退会、管理者削除、参加申請の承認/却下
- [x] **SP レスポンシブ対応**(#81〜#84)— ドロワー/シート化、カレンダー SP 化、外側余白の一元化
- [x] **道場内フィード + スレッド + AikiNote 連携**(#86〜#89)— 画像/動画添付(非公開 Storage + 署名 URL)、引用共有・クロスポスト
- [x] **通知(アプリ内)**(#90〜#91)— ヘッダーのベル + 未読バッジ
- [x] **アクティビティログ(有料)+ feature_flag 基盤**(#92〜#93)— `hasFeature` / `requireFeature` / PRO ロック表示
- [x] **道場ページ(公開)+ 未認証公開カレンダー + 設定画面**(#94〜#95)— `/d/<slug>` を認証状態で出し分け、SEO メタデータ
- [x] **道場マスタ双方向書き込み**(#96)— 未登録道場をその場で追加(AikiNote 側にも反映)
- [x] **アーカイブ(有料)**(#97)— 階層ページ + リッチテキスト + 添付 + 検索
- [x] **会計の見える化(有料)**(#98)— 月謝ステータス + 支出記録 + 収支グラフ
- [x] **ボード Todo 管理**(#99)— owner/admin 限定のカンバン

### 残タスク

残タスクの全体像・優先度・実装方針は **[`docs/roadmap.md`](docs/roadmap.md)(普及ロードマップ)** に集約した。主要どころ:

- 本番環境の棚卸し(migration 適用確認)・Resend ドメイン認証・OAuth(Google/Apple)・利用規約(リリースブロッカー)
- アドミン任命・ボード削除(運営体制のライフサイクル)
- トップページ(LP)・オンボーディング・招待 QR・公開ページの問い合わせフォーム(導入体験)
- SP 最適化スイープ・言語切替 UI・PWA(毎日使える体験)
- レート制限・バックアップ方針・E2E・監視(信頼と運用)
- 決済(Stripe)+ プラン制限の enforcement(収益化)
