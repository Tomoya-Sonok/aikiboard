---
name: "quality-check"
description: "Run typecheck, lint, and tests across the monorepo before a commit or before declaring an implementation complete. Trigger on phrases like \"品質チェック\", \"コミット前チェック\", or immediately before reporting that an implementation is finished."
argument-hint: "(引数不要。カレントの working tree に対して実行する)"
metadata:
  author: "aikiboard"
user-invocable: true
disable-model-invocation: false
---

## 振る舞い制約(このスキル共通)

- 推測で埋めない。不明点は `[TBD]` タグで残す
- 人間への質問は必ず「選択肢付き」で提示し、1回につき最大4問。白紙の質問は禁止
- 選択肢には必ず「上記以外(具体的に: ___)」を含める
- 質問は重大度順(Critical → High → Medium → Low)に出し、複数ラウンドに分ける

## 前提

このリポジトリの `check` スクリプト(`biome check . && tsc --noEmit`)はlintとtypecheckを1コマンドで行う構成であり、個別のtypecheck専用スクリプト・lint専用スクリプトは存在しない(`docs/conventions.md` の Lint・フォーマット節を参照)。そのため「typecheck→lint」は `pnpm -r check` の1コマンドで代替する。

## 手順

1. 以下を**この順で**実行する(すべて `package.json` に実在するスクリプト)。
   1. `pnpm -r check` — 各パッケージで `biome check .`(lint)→ `tsc --noEmit`(typecheck)。
   2. `pnpm -r test:ci` — 各パッケージで `vitest run --silent --passWithNoTests`。
2. いずれかのコマンドが失敗したら:
   - 失敗したコマンドの実際の出力をそのまま貼る。
   - 出力から原因を説明する。
   - 修正を行い、**失敗したコマンドから**再実行する。
   - この「実行 → 失敗 → 修正」のサイクルは**最大3回**まで。
3. 3回失敗しても解消しない場合はそこで止め、人間に報告する。エラー内容・試した修正・推測される原因を添える。**「通ったことにする」ことは禁止**(出力を見ずにPASSと言わない、一部のコマンドだけ実行してPASSと言わない、キャッシュされた過去の結果を使い回さない)。
4. `pnpm -r check` と `pnpm -r test:ci` の両方が実際に成功した場合のみ「品質チェック PASS」と報告する。**この報告をしていない状態で実装完了を宣言してはならない**。

## Done When

- [ ] `pnpm -r check` と `pnpm -r test:ci` を実行し、両方の実際の出力を確認した
- [ ] 失敗があれば実際に修正して再実行し、3回で解消しなければ止めて報告した
- [ ] 全部成功した場合のみ「品質チェック PASS」と明示的に報告した
