# Architecture / Process Decision Records (ADR)

このディレクトリは、AikiBoard の **アーキテクチャ・開発プロセス上の意思決定** を記録します。「なぜその構成・運用にしたのか」を後から追えるようにし、将来の自分・チームが同じ議論を繰り返さないための記録です。姉妹サービス AikiNote(`docs/adr/`)の前例に倣います。

## このディレクトリの起点

ADR 0001〜0004 は、**Phase 0(基盤構築)完了から Phase 1(MVP 開発)着手への切替時(2026-06-03)** に運用方針を集中的に詰めた結果を記録したものです。AikiNote の運用パターンを基本としつつ、AikiNote 固有の負債(`any` 運用、複雑な自前 JWT、本番 DB 直繋ぎ、巨大なフラット `procedures.ts` 等)で改善余地のある箇所は AikiBoard 側で **意図的に乖離** する、という方針で決定しています。

## インデックス

| # | タイトル | 状態 | 確定日 | 対応方針 |
|---|---|---|---|---|
| [0001](0001-development-flow-and-pr-operation.md) | 開発フローと PR 運用 | Accepted | 2026-06-03 | A-1 / A-2 |
| [0002](0002-architecture-decisions.md) | アーキテクチャ方針(型生成・認証・tRPC・状態管理) | Accepted | 2026-06-03 | B-4〜B-7 |
| [0003](0003-quality-gates.md) | 品質ゲート(テスト・lint-staged・logger・Storybook) | Accepted | 2026-06-03 | C-8〜C-10 |
| [0004](0004-environment-and-migration-strategy.md) | 環境戦略と migration 運用 | Accepted | 2026-06-03 | D-11 / D-12 |

## 書き方

- 1 ファイル 1 ADR、ファイル名は `NNNN-英語-kebab-case.md`、本文は日本語。
- 構成: タイトル(決定の要約) → リード文 → `## Considered Options`(採用案 / 不採用案とその理由) → `## Consequences`(結果・注意点・今後の宿題)。
- 状態は `Accepted` / `Superseded by NNNN` / `Deprecated` を上表で管理する。
- 決定を覆す場合は既存 ADR を書き換えず、新しい ADR を追加して上表の状態を更新する(履歴を残す)。

## 補足: ローカル運用ルールとの棲み分け

`.agent/`(AI エージェント向けローカル設定)は `.gitignore` 対象でリポジトリにコミットされません。**チームで共有すべき運用・設計判断は必ずこの ADR か [`CLAUDE.md`](../../CLAUDE.md) 側に記録** してください。
