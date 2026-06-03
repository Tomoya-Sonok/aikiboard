# 品質ゲート — テスト戦略・lint-staged・logger・Storybook

Phase 1 以降の品質を担保するゲートを定義する。テストは AikiNote の方針(ユーザーアクションを伴う仕様を網羅、AAA パターン)をベースに、AikiBoard 固有の **RLS policy integration test** を追加する。ツーリング(lint-staged / logger / Storybook)も合わせて確定する。

## C-8: テスト戦略

- **必須カバー**: backend route handler(主要 endpoint)/ backend middleware(auth / boardMember / boardAdmin)/ backend lib(pure 関数)/ frontend hooks(useAuth 等)/ frontend utils(date / validation / 計算系)。
- **推奨カバー**(ユーザー操作を伴うもの): frontend components(form / modal)/ frontend page integration(主要フロー: ログイン → ボード作成、出欠表明 等)。
- **AikiBoard 固有 — RLS policy integration test**: Phase 1 中盤(最初の機能が一巡した時点)で導入。ローカル Supabase(ADR 0004)を使い `backend/src/routes/<feature>/<feature>.integration.test.ts` に配置。各ロール(owner / admin / member / anon)× 各 RLS を 1 ケースずつ。
- **書くタイミング**: **機能 PR 同梱で必須**。PR テンプレートで明示し、書かない場合は理由を必須記載。
- スコープ外: E2E(MVP 安定後に Playwright で critical path のみ smoke)、Visual regression(不要)、カバレッジ数値目標(質を歪めるため計測しない)。

## C-9: pre-commit に lint-staged を追加

- 現状の pre-commit / pre-push は維持しつつ、**lint-staged で変更ファイルのみ Biome 適用**(Husky pre-commit で発火)。
- commitlint は導入しない([ADR 0001](0001-development-flow-and-pr-operation.md) 参照。squash & merge + PR タイトル規約で代替)。

## C-10: 暫定観測性 — 軽量 logger ラッパー

- `backend/src/lib/logger.ts` を作成し `logger.debug / info / warn / error` を提供。
- 内部実装は `console.*(JSON.stringify({ timestamp, level, message, ...context }))` で構造化ログ。
- AikiBoard 固有メタデータ(`boardId` / `userId` / `feature`)を context として渡せる設計。
- Phase 2 で Sentry / Axiom 導入時、この 1 ファイルの変更で送信処理を追加できる(差し替え容易)。Frontend は当面 `console.error`(Sentry 導入時に統一)。

## Storybook

- **全コンポーネントに story を必須**(`atoms` / `molecules` / `organisms` / `shared` / `features`)。
- 例外: Next.js 特殊ファイル(`page.tsx` / `layout.tsx` / `error.tsx` / `loading.tsx`)、Server Component で複雑なデータ取得を伴うもの。例外時は PR に理由を明記。
- **Storybook を GitHub Pages にデプロイ**(AikiNote 同様、`main_ci.yml` に deploy-storybook ジョブ)。

## Considered Options

- **テストを機能 PR 同梱必須 vs 後追い(採用: 同梱)**: 後追いはほぼ書かれず腐る。PR テンプレで「書いた / 書かない理由」を強制し、テストを変更と不可分にする。
- **カバレッジ計測の有無(採用: しない)**: 数値目標は「カバレッジのためのテスト」を生み質を歪める。ユーザーアクション網羅という質的基準で運用。
- **RLS テストの要否(採用: 必要)**: AikiBoard は board_members JOIN ベースの RLS が要。ロール境界のバグは情報漏洩に直結するため、ローカル Supabase で各ロールを実地検証する。AikiNote には無い AikiBoard 固有の追加。
- **logger を最初から Sentry / Axiom 連携(不採用)**: Phase 1 で外部 SaaS を増やすと運用負荷。interface だけ先に固め、実送信は Phase 2 で 1 ファイル差し替え。

## Consequences

- lint-staged / logger / PR テンプレ / Storybook の実体は後続 PR(PR3 / PR5)で導入する。本 ADR はその方針の根拠。
- RLS integration test はローカル Supabase([ADR 0004](0004-environment-and-migration-strategy.md))に依存するため、導入順序は「ローカル Supabase → RLS テスト」になる。
- Storybook Pages デプロイには GitHub Pages の有効化(Source = GitHub Actions)が必要。
