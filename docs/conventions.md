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

## テスト方針

- Vitest。`happy-dom` 環境。AAAパターン(Arrange/Act/Assert)を守る。
- 「ユーザーアクションを伴う仕様」(API呼び出し・状態変更・エラーハンドリング)を優先してテストし、「画面表示のみ」のテストは書かない。
- テストは実装と同じディレクトリに `<対象名>.test.ts(x)` として置く(共通の `__tests__/` ディレクトリは使わない)。
- backendのRLS検証は `*.integration.test.ts` に分離する(ローカルSupabase必須、CI除外)。
- **テストファースト(TDD)は必須化しない**。「ユーザーアクションを伴う仕様を網羅的にテストする」ことのみを規約とし、実装とテストのどちらを先に書くかは開発者・AIの判断に委ねる。

## Lint・フォーマット

- Biome(`frontend/biome.json` / `backend/biome.json`、`recommended`ルール)。
- インデント2スペース、ダブルクォート、末尾カンマ`all`。
- コミット前に `pnpm -r check`(Biome + `tsc --noEmit`)を通す。

## コミットメッセージ・PR

- Conventional Commitsのprefix(`feat:` `fix:` `chore:` `docs:` `test:` `perf:`)+ prefix以外は日本語。
- ブランチ名: `feat/...` `fix/...` `chore/...` `docs/...`。Issue紐付けは `feat/#<issue>_...`。
- マージ戦略: merge commit(スタックPRの連鎖コンフリクトを避けるため。単発PRのsquash強制は撤回。ADR 0001は別途この実態に合わせて更新する)。
- PRを立てる前に `pnpm check && pnpm build && pnpm test` を通す。main直pushは緊急hotfix以外禁止([`constitution.md`](constitution.md)原則5)。

## 完了の定義

**「完了」とは、`pre-push` フックとCI(GitHub Actions)が実際に通ることを指す。AIの「実装できました」という自己申告は完了ではない**(`CLAUDE.md` にも明記)。具体的には以下がすべて成立した状態:

- `.husky/pre-commit`: ステージ対象ファイルへの lint-staged(Biome)と gitleaks のシークレットスキャンが通過している
- `.husky/commit-msg`: commitlint(Conventional Commits)が通過している
- `.husky/pre-push`: `pnpm -r typecheck` と `pnpm -r test:ci` が通過している
- CI(`frontend_ci.yml` / `backend_ci.yml`): lint・typecheck・test・build が通過している

これらはローカルフック(`--no-verify` でバイパス可能)とCI(GitHub側でrequired statusにする運用、`docs/development-guide.md` 参照)の二重で強制する。フックが通ったことは「ローカルでは問題ない」ことしか保証しないため、PRのCIが green であることが最終的な完了条件になる。
