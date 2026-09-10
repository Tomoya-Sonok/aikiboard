# 開発規約(Conventions)

このアプリの実装(`docs/ARCHITECTURE.md`)から明文化した開発規約。業務原則は [`docs/constitution.md`](constitution.md) を参照。

## TypeScript

- `strict: true` を維持する(`noImplicitAny` / `strictNullChecks` / `noUnusedLocals` / `noUnusedParameters` すべて有効、backend/frontend共通)。
- `import type` の強制はしない(`biome.json` の `style.useImportType: "off"`)。
- 型名/interfaceはPascalCase。ロール・ステータス等のリテラルユニオンは小文字文字列(`"owner"|"admin"|"member"` 等)。DBカラム(snake_case)はDTOでcamelCaseへ詰め替える。
- **`any` は原則禁止**。Biomeに `noExplicitAny`(またはそれに相当するルール)を新規追加し、既存箇所も新規PRで触れる際は解消する。どうしても型を付けられない箇所(外部ライブラリの緩い型等)は `unknown` + 型ガードで受け、`// biome-ignore lint/suspicious/noExplicitAny: <理由>` を添えて明示的に例外化する。

## ディレクトリ配置

- backend: `backend/src/routes/<kebab-case-name>/index.ts` に機能ごとのHonoルートをまとめ、同ディレクトリに `*.test.ts`(必要なら `*.integration.test.ts`)を置く。
- frontend: `frontend/src/components/{shared|features/<domain>}/<PascalCaseComponentName>/` に `.tsx` + `.module.css` を置く。テスト(`.test.tsx`)・Storybook(`.stories.tsx`)は書く場合のみ同ディレクトリに追加する。これが原則。
- **例外は条件付きで許容する**: 「密接に関連し、常に一緒に使われる小さな補助コンポーネント」の同居(例: `dashboard/` の `DashboardCards`+`AnnouncementsCard`+`NextPracticeCard`)、および「親ディレクトリでのCSS共有」(例: `auth/authForm.module.css`)は、独立して再利用されない・粒度が小さいという条件下でのみ許容する。単独で再利用されうる・状態やロジックを持つコンポーネントは必ず自分のディレクトリを持つこと。既存の例外はこの基準を満たすため現状のまま容認する。

## APIレスポンス形式とエラー処理

- 成功時: `{success: true, data: ...}`。エラー時: `{success: false, error: string, code?: string}`。この形は全エンドポイント共通。
- HTTPステータス: `400`=バリデーション失敗、`401`=未認証、`403`=権限不足/`feature_locked`、`404`=非メンバー(存在を隠す。[`constitution.md`](constitution.md)原則2)、`409`=重複、`500`=DBエラー。
- **一覧APIのページネーションは新規実装で `{data: {items, total, limit, offset}}` に統一する**(件数・ページ送りの有無に関わらずこの形を既定とする)。既存の `{data: [...]}` 型の一覧(`boards`/`members`/`invitations`/`board-todos`)は非強制とし、書き換えは別タスクとする。
- **frontendの一覧・詳細取得(クエリ)が失敗した場合、新規実装は必ずエラー状態を画面に表示する**(`isError` を見て専用のエラー表示を出す。`InviteJoin.tsx` の実装を参考にする)。「取得失敗時に静かに空配列へフォールバックする」既存実装は非強制とし、書き換えは別タスクとする。
- backendのエラー処理ヘルパー(`parseJson` 等)の共通化は今回規約化しない。新規ルートも既存パターン(`if (error) { logger.error(...); return c.json({success:false,...}, status) }`)を踏襲してよい。
- **クエリ失敗時のエラー表示は、条件付きクエリ(`enabled: ...`)やダイアログ内のクエリも対象**とする。「データが無いときと同じ見た目になる」実装は不可。
  **Why**: ボード削除の確認ダイアログで、削除前集計(`deletionSummary`)の取得に失敗しても集計欄が消えるだけでエラーが出ない実装をした。上の規約はあったが「条件付きクエリも対象」と読めなかった。

## テスト方針

- Vitest。`happy-dom` 環境。AAAパターン(Arrange/Act/Assert)を守る。
- 「ユーザーアクションを伴う仕様」(API呼び出し・状態変更・エラーハンドリング)を優先してテストし、「画面表示のみ」のテストは書かない。
- テストは実装と同じディレクトリに `<対象名>.test.ts(x)` として置く(共通の `__tests__/` ディレクトリは使わない)。
- backendのRLS検証は `*.integration.test.ts` に分離する(ローカルSupabase必須、CI除外)。
- **テストファースト(TDD)は必須化しない**。「ユーザーアクションを伴う仕様を網羅的にテストする」ことのみを規約とし、実装とテストのどちらを先に書くかは開発者・AIの判断に委ねる。
- **入力欄が複数ある画面のテストで要素を取るときは `getByRole("textbox")` を使わず、`getByLabelText` / `getByText` で特定する**。
  **Why**: `SettingsView` の削除ダイアログのテストで `getByRole("textbox")` が設定フォームの他の input と重複マッチし、2件が「Found multiple elements」で落ちた。

## Lint・フォーマット

- Biome(`frontend/biome.json` / `backend/biome.json`、`recommended`ルール)。
- インデント2スペース、ダブルクォート、末尾カンマ`all`。
- コミット前に `pnpm -r check`(Biome + `tsc --noEmit`)を通す。
- **スクリプト(python/sed 等)やヒアドキュメントでファイルを機械的に書き換えた直後は、`biome check --write <該当ファイル>` を通してから `pnpm -r check` を実行する**。
  **Why**: テストファイルを python スクリプトで書き換えた結果、フォーマット差分で `pnpm -r check` が1回失敗した(Edit ツールでの編集では起きなかった)。

## コミットメッセージ・PR

- Conventional Commitsのprefix(`feat:` `fix:` `chore:` `docs:` `test:` `perf:`)+ prefix以外は日本語。
- ブランチ名: `feat/...` `fix/...` `chore/...` `docs/...`。Issue紐付けは `feat/#<issue>_...`。
- マージ戦略: merge commit(スタックPRの連鎖コンフリクトを避けるため。単発PRのsquash強制は撤回。ADR 0001は別途この実態に合わせて更新する)。
- PRを立てる前に `pnpm check && pnpm build && pnpm test` を通す。main直pushは緊急hotfix以外禁止([`constitution.md`](constitution.md)原則5)。

## 仕様と実装のずれを埋めるとき

実装中に「仕様に書かれていないが決めないと書けない」ことに必ず出会う。その扱いを固定する。

- **仕様に無い制約を実装判断で足す場合、コードより先に `spec.md` へ理由付きで書く**(`CLAUDE.md` の仕様変更の順序と同じ)。
  **Why**: 「自分自身のロール変更は不可」は既存のメンバー削除パターンから実装者が決めた制約で、PRD にもユーザーの回答にも無かった。spec.md には後から書いたため、一時的にコードが仕様を先行した。
- **「〜等」で曖昧に受けた対象(集計項目・表示項目・通知先など)は、具体化した内容を `spec.md` に列挙してから実装する**。
  **Why**: 削除前集計の「メンバー数・投稿数等」の「等」の中身を、実装者判断で5項目(メンバー/投稿/稽古/お知らせ/アーカイブ)に決めた。
- **UI 文言で機能の説明を書くときは、実装済みの権限・機能範囲と突き合わせてから書く**。
  **Why**: 昇格確認の文言に「管理者はお知らせの作成やメンバーの承認ができるようになります」と書いたが、admin の権限範囲(Todo 管理・アクティビティログ閲覧等も含む)と突き合わせずに書いた。

## spec-kit スキルとこのリポジトリの規約が衝突したとき

- **既存機能の変更では、`/speckit-*` が作ろうとする `specs/NNN-<name>/` を使わず、既存の `specs/{feature}/` を更新する**。新規ディレクトリは新機能のときだけ作る(`specs/README.md` の粒度規約が優先)。
  **Why**: `/speckit-specify` の標準動作(連番ディレクトリ作成 + `.specify/feature.json` 書き込み)とプロジェクト規約が衝突したが、その解決方法がどこにも記録されておらず、実行時に判断する羽目になった。
- **`.specify/feature.json` を書かない運用にした結果、`/speckit-plan` `/speckit-tasks` は前提を満たせず起動できない**。既存機能の変更では、これらを起動せず `plan.md` / `tasks.md` を手書きする。**その場合は報告で「スキルを起動した」と書かず「手書きした」と明記する**。
  **Why**: 今回 `/speckit-plan` `/speckit-tasks` を起動する前提で進行を宣言したが、実際にはスキルを起動せず手で作成した。宣言と実態がずれた。

## 完了の定義

**「完了」とは、`pre-push` フックとCI(GitHub Actions)が実際に通ることを指す。AIの「実装できました」という自己申告は完了ではない**(`CLAUDE.md` にも明記)。具体的には以下がすべて成立した状態:

- `.husky/pre-commit`: ステージ対象ファイルへの lint-staged(Biome)と gitleaks のシークレットスキャンが通過している
- `.husky/commit-msg`: commitlint(Conventional Commits)が通過している
- `.husky/pre-push`: `pnpm -r typecheck` と `pnpm -r test:ci` が通過している
- CI(`frontend_ci.yml` / `backend_ci.yml`): lint・typecheck・test・build が通過している

これらはローカルフック(`--no-verify` でバイパス可能)とCI(GitHub側でrequired statusにする運用、`docs/development-guide.md` 参照)の二重で強制する。フックが通ったことは「ローカルでは問題ない」ことしか保証しないため、PRのCIが green であることが最終的な完了条件になる。
