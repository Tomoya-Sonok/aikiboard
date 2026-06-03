# 環境戦略と migration 運用 — ローカル Supabase + 本番 Dashboard 手動 apply

ローカル開発 DB と本番マイグレーションの運用を確定する。AikiBoard は AikiNote と **同一 Supabase プロジェクトをスキーマ分離(`public` / `aikiboard`)で共有** するため、本番 DB への副作用を避ける設計を最優先する。

## D-11: ローカル DB は Supabase コンテナ

- `pnpm dlx supabase init` + `pnpm dlx supabase start` で Docker スタックを起動し、ローカル開発に使う。
- ローカル開発時の env は `.env.local` をローカル Supabase 用に切り替える。
- AikiBoard の `aikiboard` schema に加え、AikiNote 側の最小ダミー `public."User"` / `public."DojoStyleMaster"` を seed migration で用意する。
  - ファイル: `backend/src/migrations/000_seed_public_schema_for_local_dev.sql`(**本番には絶対適用しない** ことを冒頭コメントで明示)。
- ローカル apply: `pnpm dlx supabase db reset`(連番 migrations を頭から再適用)。
- フォールバック: 解消不能な技術課題が出たら、別 Supabase プロジェクトを staging として使う案に切り替える。

## D-12: マイグレーション運用

- migrations 配置: `backend/src/migrations/NNN_*.sql`(3 桁連番、AikiNote と完全同位置)。Phase 0 の `supabase/migrations/0001-0008`(4 桁)はここへ移動・リネームする(PR2)。
- migration 内コメントの DB 参照は `public."User"`(引用符付き PascalCase。AikiNote の実テーブル名)に統一する。
- **本番 apply は Supabase Dashboard の SQL Editor で手動継続**。Supabase CLI の `db push` は AikiNote schema への副作用リスクがあるため使わない(`000_seed_*.sql` は本番では実行しない)。
- **適用状況の追跡**: PR テンプレの「DB マイグレーションあり → 本番適用済み」チェックボックスで管理。git log + マージ済み PR を真実の source とする。
- **Rollback ポリシー: forward-only**。down script は書かない(SaaS の DDL は roll-forward が業界標準)。
- migrations の冒頭ガイドは `backend/src/migrations/README.md` に集約する。

## Considered Options

- **ローカル DB(採用: Supabase コンテナ / フォールバック: 別 staging プロジェクト)**: 同一プロジェクト共有のため、ローカルから本番 schema を触らない隔離が必須。Docker のローカル Supabase が最も本番に近く副作用ゼロ。CLI で詰まったら staging プロジェクトに退避。
- **本番 apply(採用: Dashboard 手動 / 不採用: CLI db push)**: `db push` は対象 schema 全体を差分適用しようとし、共有している AikiNote の `public` schema に予期せぬ変更を及ぼすリスクがある。手動 apply は手間だが安全側。
- **Rollback(採用: forward-only / 不採用: down script)**: 本番 DDL の巻き戻しは down script でも安全に戻せないことが多く、SaaS では前進修正(新しい migration で直す)が標準。down を書く労力を別の安全策(適用前の Dashboard 確認)に回す。

## Consequences

- migrations を `backend/src/migrations/` に移すと、Phase 0 の `supabase/migrations/` パスを参照する箇所(もしあれば)の更新が要る(PR2 で確認)。
- 本番適用が手動のため、「マージ済みだが本番未適用」の乖離が起きうる。PR テンプレのチェックボックスと self-check で塞ぐ。
- `000_seed_*.sql` をうっかり本番で実行すると AikiNote のダミーデータが混入する。ファイル名 + 冒頭コメント + 本番 apply 手順(seed を除外)で多重に防ぐ。
