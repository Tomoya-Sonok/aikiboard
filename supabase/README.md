# supabase/migrations — AikiBoard スキーマ適用ガイド

このディレクトリは AikiBoard 用の SQL マイグレーション群です。**実行はユーザー手動**(Supabase Dashboard SQL Editor または Supabase CLI)で行います。Phase 0 セットアップで一度だけ流せば終わり、Phase 1 以降のスキーマ変更は**追加の連番ファイル(0009, 0010, ...)** として積み増します。

## 前提

- AikiBoard は AikiNote と **同一の Supabase プロジェクト** を使用し、`aikiboard` スキーマで論理分離する方針です(`docs/requirements.md` 5.4 / 10.3 参照)。
- 既存の `public` スキーマ(AikiNote 既存テーブル)は **変更しません**。
- 適用前に **必ず** `public.users` / `public.DojoStyleMaster` の既存定義に影響しないことを確認してください(本マイグレーションは `aikiboard` schema にしか CREATE しません)。

## 適用順序

`0001` → `0002` → ... → `0008` の順番で実行してください。番号は依存順を意味します。

| ファイル | 内容 |
|---|---|
| `0001_create_aikiboard_schema.sql` | `aikiboard` schema 作成 + GRANT + 共通ヘルパ関数 + `set_updated_at` トリガ関数 |
| `0002_create_core_tables.sql` | boards / board_settings / board_members / board_dojo_masters / invitations / activity_logs |
| `0003_create_event_tables.sql` | events / event_rsvps |
| `0004_create_communication_tables.sql` | announcements / announcement_reads / board_posts / board_post_attachments / threads |
| `0005_create_archive_tables.sql` | archives / archive_attachments |
| `0006_create_finance_tables.sql` | member_fees / fee_payments / expense_entries |
| `0007_create_feature_flag_tables.sql` | plans / features / plan_features / board_subscriptions + 初期 seed |
| `0008_apply_rls.sql` | 全テーブルに RLS 有効化 + ポリシー定義 |

## 適用方法

### A. Supabase Dashboard SQL Editor(推奨、Phase 0 初回適用)

1. Supabase Dashboard を開く(AikiNote と同一プロジェクト)
2. 左メニュー **SQL Editor** → **+ New query**
3. `0001_create_aikiboard_schema.sql` の中身を貼り付け、**Run** で実行
4. エラーが無ければ次のファイル(`0002`)に進む。途中エラーが出たら **Rollback** で戻し、修正
5. `0008` まで全て実行できたら、左メニュー **Database → Schemas → aikiboard** でテーブル一覧と RLS が有効になっていることを確認

### B. ドライラン(本番反映前の素振り)

各ファイルを `BEGIN;` ... `ROLLBACK;` で囲って実行すれば、変更をコミットせずに構文・依存関係エラーだけチェックできます。

```sql
BEGIN;
-- ここにマイグレーションの中身を貼る
ROLLBACK;
```

### C. Supabase CLI(将来の自動化用、現時点は推奨しない)

```bash
supabase login
supabase link --project-ref <project-ref>
supabase db push   # supabase/migrations/ を順に適用
```

CLI 利用時は `.env` で `SUPABASE_DB_URL` を設定する必要があります。AikiNote と同一プロジェクトでの誤適用リスクがあるため、Phase 0 では Dashboard SQL Editor 推奨。

## ロールバック

`0001`〜`0008` 全体をロールバックする場合:

```sql
DROP SCHEMA aikiboard CASCADE;
```

これで `aikiboard` schema 配下のテーブル・関数・ポリシー・トリガが全削除されます。`public` schema には影響しません。

## 注意点

- **`public.users` / `public.DojoStyleMaster` への FK 制約は、本マイグレーションでは付与していません**。これは型・カラム名(特に `DojoStyleMaster` の引用符付き識別子)の差異で apply が失敗するリスクを避けるため。Phase 1 で実装担当者がスキーマを確認した上で `ALTER TABLE ... ADD CONSTRAINT` で追加してください。
- `auth.uid()` を使った RLS ポリシーは Supabase Auth のセッション JWT 経由で評価されます。バックエンド(Cloudflare Workers)は `SUPABASE_SERVICE_ROLE_KEY` で動作するため RLS をバイパスします。
- `aikiboard` schema 内のテーブルへ frontend から直接アクセスする場合は `SUPABASE_ANON_KEY` を使い、RLS で防御層を設けてください。
- フィーチャーフラグ初期データ(`plans` / `features` / `plan_features`)は `0007` 末尾で INSERT しています。料金確定後に値を更新したい場合は別途 `UPDATE` または専用マイグレーションを書いてください。
