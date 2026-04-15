# CLAUDE.md

このファイルは Claude Code（claude.ai/code）が aikiboard リポジトリで作業する際のガイドラインを提供します。

> **⚠️ 本プロジェクトは準備段階です。**
>
> 要件定義・技術選定はまだ完了していません。現時点では雛形ドキュメントと仮の要件定義書・モックのみが存在し、具体的な実装仕様（コーディング規約・CSS ルール・テスト方針・ディレクトリ構造等）は未確定です。
>
> 詳細は今後の慎重な要件定義プロセスを通して FIX していきます。
>
> - 仮要件定義書（叩き台）: [`docs/draft/requirements.md`](docs/draft/requirements.md)
> - 参考モック（React、ビジュアル叩き台）: [`docs/draft/mock.tsx`](docs/draft/mock.tsx)

## セッション開始

セッション開始直後に `.agent/instructions.md` を1度だけ読み込み、その内容に従ってからユーザーの指示を待つこと。

## プロジェクト概要

AikiBoard は、合気道の道場・会などのコミュニティを運営する管理者向けの **道場管理＆コミュニケーションプラットフォーム** です。個人向け稽古日誌アプリ **AikiNote** の姉妹サービスとして、共通アカウント基盤のもとで連携しながら提供される想定です。

メタファーは「道場の掲示板（Board）」。AikiNote が個人の「ノート」であるのに対し、AikiBoard は道場に所属するメンバー全員が集まる「掲示板 / ダッシュボード」と位置づけられます。

詳細な機能・権限モデル・MVP スコープは [`docs/draft/requirements.md`](docs/draft/requirements.md)（仮）を参照してください。

## 主要コマンド

> 技術スタック未確定のため、開発・テスト・ビルドコマンドは未策定です。技術選定 FIX 後に AikiNote の構成（pnpm monorepo / `pnpm dev` / `pnpm test` / `pnpm check` 等）を参考に決定する想定です。

## 技術スタック

> **未確定**。AikiNote のスタックを参考候補とする可能性が高いため、参考までに以下を記載します（**確定仕様ではありません**）。
>
> - フロントエンド: Next.js（App Router）/ TypeScript / CSS Modules / next-intl / Zustand / TanStack Query / tRPC
> - バックエンド: Hono / TypeScript / Zod
> - DB & Auth: Supabase（候補）
> - リント / フォーマッタ: Biome
> - テスト: Vitest
> - ホスティング: Vercel（Frontend）/ Cloudflare Workers（Backend）など
>
> 採用技術が FIX するまで、実装コード生成・依存追加・コマンド提案は控えること。

## アーキテクチャ

> **未確定**。要件定義 FIX 後に策定。AikiNote の構成（Monorepo / SP First / コンポーネント階層 / API 通信パターン）を参考候補とする。

## コードスタイル / CSS / テスト / 実行環境

> いずれも **未確定**。実装開始時に AikiNote の規約をベースに策定する方針。
>
> AikiNote 固有の詳細仕様（CSS 変数対応表・z-index 変数表・PWA standalone 対応・Supabase RLS ポリシー等）は、本ファイルにまだコピーしないこと（仕様汚染防止）。確定したものから順次本ファイルへ反映していきます。

---

実装フェーズに入った段階で、本ファイルは AikiNote の `CLAUDE.md` を参考に肉付けしていく予定です。
