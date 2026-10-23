# 開発フローと PR 運用 — PR ベース + main branch protection

Phase 1 着手にあたり、開発フローを **PR ベース運用** に切り替える(Phase 0 までは main 直 push)。ブランチ命名・コミット規約・マージ戦略・ブランチ保護を以下に確定する。AikiNote の運用を踏襲しつつ、AikiNote には無かった **main branch protection** と **PR テンプレート** を最初から導入する。

## 決定事項

### ブランチ・コミット

- ブランチ命名: `feat/...` / `fix/...` / `perf/...` / `chore/...` / `docs/...`、Issue 紐付けは `feat/#<issue>_...`(AikiNote 規約)。
- コミット / PR タイトル: Conventional Commits の prefix(`feat:` `fix(scope):` `chore:` `docs:` `test:` `perf:`)+ **prefix 以外は日本語**(AikiNote 規約)。
- main 直 push は禁止(タイポ・緊急 hotfix のみ例外)。

### マージ戦略・ブランチ保護

- main に **branch protection** を有効化(CI 必須、PR 必須)。self-review 前提で approvals は 0。
- **squash and merge を強制**(merge commit / rebase は無効化)。squash 時のデフォルトコミットメッセージ = PR タイトル。
- `delete_branch_on_merge: true`(マージ済みブランチ自動削除)。
- Require linear history は **OFF**(squash 運用のため不要)。force push は restrict、ブランチ削除は不可。

### PR テンプレート

- `.github/pull_request_template.md` を導入し、動作確認・影響範囲(DB マイグレーション)・テスト・Storybook・メモを必須チェック項目とする(実体の作成は PR3)。

## Considered Options

- **PR ベース + branch protection + squash 強制(採用)**: 変更を PR 単位でレビュー・CI 通過させてからマージ。squash で main 履歴を 1 PR = 1 コミットに保ち `git log` を読みやすく保つ。self-review でも「時間を置いて読み返す」レビュー機会が生まれる。
- **main 直 push 継続(不採用)**: Phase 0 のスピード優先期は妥当だったが、機能実装フェーズでは CI 未通過コードが main に入るリスク・履歴追跡性の低下が大きい。
- **merge commit / rebase merge を許可(不採用)**: feature ブランチの中間コミットが main に流入し履歴が汚れる。squash に一本化して粒度を PR 単位に統一する。
- **commitlint の導入(不採用)**: squash & merge 前提では main に乗るのは PR タイトルのみ。PR タイトル規約で実質的に Conventional Commits が担保されるため、中間コミットを縛る commitlint は過剰。

## 追補(2026-09-10): マージ戦略を実態に合わせて改訂

上記「squash and merge を強制(merge commit / rebase は無効化)」は、運用の結果として**撤回**する。

- **スタック PR(依存する PR を積み上げる運用)を squash マージすると、後続 PR が連鎖的にコンフリクトする**。#86〜#99 のスタック運用で実証されたため、以降は**上から順に merge commit でマージ**している。
- GitHub 側の設定も実態と一致している(Ruleset の `allowed_merge_methods` は merge / squash / rebase すべて許可、`required_approving_review_count: 0`)。
- **required status checks(CI 必須化)は未設定**。CI は paths フィルタで skip されることがあり必須化すると PR がブロックされうるため、意図的に見送っている(`docs/development-guide.md` にも記載)。
- 変わらない点: main 直 push 禁止(緊急 hotfix のみ例外)、`delete_branch_on_merge: true`、ブランチ命名とコミット規約(prefix 以外日本語)。

現行の規約は [`docs/conventions.md`](../conventions.md) の「コミットメッセージ・PR」節を正とする。

## Consequences

- branch protection と Pull Requests 設定(squash のみ許可・auto delete head branches)は **GitHub UI 側の手動設定** が必要。この設定が有効化されるまでは main 直 push が物理的に可能なので、設定完了までは運用ルールとして直 push を避ける。
- approvals 0 のため、レビューの質は「PR を立てて少し時間を置いてから自分で読み返す」self-review の習慣に依存する。
- 緊急 hotfix で直 push する場合も、事後に PR or commit で記録を残す。
