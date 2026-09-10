# CLAUDE.md

AikiBoard(道場管理プラットフォーム)開発時にAIエージェントが従うルーティング文書。**ここには規約の本文を書かない**。実際の内容は下記の正典を参照すること。

## 重要

- 日本語で応答する
- コードから確認できないことは推測で埋めず `[TBD]` と残す
- 仕様変更は「人間の判断ポイント」節の順序(spec.md→plan.md→tasks.md→コード)に従う

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

## 人間の判断ポイント(ゲート)

AIは以下の3点(ゲート)**以外は確認なしで自律的に進める**。plan作成・tasks分解・実装・テスト・コミット・PR作成はゲートではない。

1. **PRD精緻化の質問への回答**(`/prd-refine` が出す選択肢に答える)
2. **`spec.md` のPASS宣言**(e2eシナリオまたは受け入れ条件が要件を表しているかを一読して承認する)
3. **PRレビューとマージ**

### ゲート以外でも確認を求める場合(例外)

- 破壊的操作(データ削除、ロールバック不可なマイグレーション等)
- 外部サービスへの送信(メール送信・決済・Webhook等)
- `docs/constitution.md` の原則に抵触しうる判断
- `specs/{feature}/open-questions.md` の `[TBD]` を実装で踏む時(下記参照)

### `[TBD]` を実装で踏んだ時

推測で埋めない。該当箇所を**スタブ化**し `// TODO([TBD] 番号)` を付けて実装を止める。対象 `open-questions.md` を更新(書式は `specs/README.md` 参照)し、判断が必要な点を報告する。

### 仕様変更の順序

`spec.md → plan.md → tasks.md → コード` の順で反映する。コードだけを直して `spec.md` を放置する逆順の変更は禁止(`specs/README.md` 参照)。**実装判断で仕様に無い制約を足すときも同じ順序**(先に `spec.md` へ理由付きで書く。詳細と spec-kit スキルとの衝突時の扱いは `docs/conventions.md` 参照)。

## 完了の定義

「完了」とは、Git hooks(`pnpm -r check` / `pnpm -r build` / `pnpm -r test:ci`)とCI(`.github/workflows/*`)が通ることを指す。**AIの「実装できました」という自己申告は完了ではない。**
