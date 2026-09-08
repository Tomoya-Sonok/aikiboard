# CLAUDE.md

AikiBoard(道場管理プラットフォーム)開発時にAIエージェントが従うルーティング文書。**ここには規約の本文を書かない**。実際の内容は下記の正典を参照すること。

## 重要

- 日本語で応答する
- コードから確認できないことは推測で埋めず `[TBD]` と残す
- 仕様変更はコードより先に `specs/{feature}/spec.md` を直す

## 正典の優先順位

矛盾があれば上位が優先する。

1. `docs/constitution.md` — 業務原則。譲れないルール
2. `docs/conventions.md` — 開発規約。コーディングスタイル
3. `specs/{feature}/spec.md` — 機能ごとの仕様。正
4. コード — spec.md の実装。派生物であり正ではない

補足資料(規約ではない、参照用):
- `docs/ARCHITECTURE.md` — as-is構造の記録
- `docs/requirements.md` — 要件定義(to-be)
- `docs/roadmap.md` — 残タスク台帳
- `docs/adr/` — 意思決定記録

## 入口ルーティング表

| 入力の種類 | 最初に実行するコマンド/スキル |
|---|---|
| 乱雑な要望メモ | `/prd` |
| PRDの精緻化 | `/prd-refine` |
| PRD確定後 | `/speckit-specify` → `/speckit-plan` → `/speckit-tasks` → `/speckit-implement` |
| コミット前 | `/quality-check` |

> `/prd` `/prd-refine` `/quality-check` はこのリポジトリにまだ存在しない(2026-09-07時点、未整備)。整備までは手動でPRDを書き(`docs/prd/_template.md`)、コミット前は `pnpm -r check && pnpm -r build && pnpm -r test:ci` を代用する。

## 人間の判断ポイント

AIは以下の3点**以外**は自律で進める。

1. PRD精緻化(`/prd-refine`)時の質問への回答
2. `spec.md` のPASS宣言(「実装してよい」状態になったという承認)
3. PRレビュー

## 完了の定義

「完了」とは、Git hooks(`pnpm -r check` / `pnpm -r build` / `pnpm -r test:ci`)とCI(`.github/workflows/*`)が通ることを指す。**AIの「実装できました」という自己申告は完了ではない。**
