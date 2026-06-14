# backend/src/migrations — AikiBoard マイグレーションガイド

AikiBoard の `aikiboard` スキーマ用 SQL マイグレーション群です。**3 桁連番**(`001`, `002`, ...)で管理し、番号は依存順を表します。Phase 1 以降のスキーマ変更は**追加の連番ファイル(`009`, `010`, ...)** として積み増します。運用方針の詳細は [ADR 0004](../../../docs/adr/0004-environment-and-migration-strategy.md) を参照。

## 方針(要点)

- **配置**: `backend/src/migrations/NNN_*.sql`(AikiNote と同位置)。
- **本番適用**: Supabase Dashboard の SQL Editor で **手動**。Supabase CLI の `db push` は AikiNote と同一プロジェクトへの副作用リスクがあるため使わない。
- **Rollback**: forward-only。down script は書かず、誤りは新しい連番で前進修正する。
- **共有 `public` スキーマ**: `public."User"` / `public."DojoStyleMaster"`(AikiNote 既存、引用符付き PascalCase)は **変更しない**。FK は型・引用符差異による apply 失敗を避けるため Phase 0 では付与せず、Phase 1 でスキーマ確認の上 `ALTER TABLE ... ADD CONSTRAINT` で追加する。

## 適用順序

`001` → `002` → ... → `012` の順で実行する(番号 = 依存順)。

| ファイル | 内容 |
|---|---|
| `001_create_aikiboard_schema.sql` | `aikiboard` schema 作成 + GRANT + 共通ヘルパ関数 + `set_updated_at` トリガ関数 |
| `002_create_core_tables.sql` | boards / board_settings / board_members / board_dojo_masters / invitations / activity_logs |
| `003_create_event_tables.sql` | events / event_rsvps |
| `004_create_communication_tables.sql` | announcements / announcement_reads / board_posts / board_post_attachments / threads |
| `005_create_archive_tables.sql` | archives / archive_attachments |
| `006_create_finance_tables.sql` | member_fees / fee_payments / expense_entries |
| `007_create_feature_flag_tables.sql` | plans / features / plan_features / board_subscriptions + 初期 seed |
| `008_apply_rls.sql` | 全テーブルに RLS 有効化 + ポリシー定義 |
| `009_grant_aikiboard_to_service_role.sql` | service_role に aikiboard テーブル/シーケンスの DML 権限を付与(backend が REST 経由で aikiboard を操作するため) |
| `010_recurrence_and_occurrences.sql` | 定期稽古対応: `event_rsvps` を開催日単位へ拡張(PK を `(event_id, occurrence_start, user_id)` へ再構成)+ `event_overrides`(この回だけ休講/上書き)テーブル + RLS |
| `011_announcements_draft_rls.sql` | お知らせの下書き(`published_at IS NULL`)防御: `announcements_select_member` を「メンバー かつ(公開済み OR 管理者)」へ絞り直し + `announcement_reads_insert_self` を「公開済み + 自分がメンバー」に限定 |
| `012_invitations_multi_use.sql` | 招待リンクを共有リンク型(マルチユース)へ: `invitations` の単一使用列(`used_by_user_id` / `used_at`)を削除し `revoked_at`(soft revoke)+ `label` を追加。有効判定は `revoked_at IS NULL AND expires_at > now()` |

> **REST 公開設定**: backend / frontend が aikiboard を REST(PostgREST)経由で扱うには、Supabase の **Exposed schemas に `aikiboard` を含める**必要がある。ローカルは `backend/supabase/config.toml` の `[api] schemas`(設定済み、`supabase start` で反映)。**本番は Dashboard → Settings → API → Exposed schemas に `aikiboard` を追加する**(Phase 1 ボード機能のデプロイ前に必須)。

## 本番適用(Supabase Dashboard、手動)

1. Supabase Dashboard を開く(AikiNote と同一プロジェクト)
2. **SQL Editor** → **+ New query**
3. `001_*.sql` の中身を貼り付け **Run**。エラーが無ければ次のファイルへ。`012` まで実行する
4. **Database → Schemas → aikiboard** でテーブル一覧と RLS の有効化を確認
5. 適用状況は PR テンプレの「DB マイグレーション → 本番適用済み」チェックで追跡する(`000_seed_*.sql` は本番では実行しない)

> **ドライラン**: 各ファイルを `BEGIN; ... ROLLBACK;` で囲めば、コミットせず構文・依存エラーだけ確認できる。

## ローカル開発(ローカル Supabase コンテナ)

ローカルは Docker 上の Supabase コンテナで開発する(本番 DB には触れない)。詳細は [ADR 0004](../../../docs/adr/0004-environment-and-migration-strategy.md) D-11。

### 初回セットアップ

1. Docker Desktop を起動しておく
2. `cd backend && pnpm exec supabase start` で Supabase スタックを起動(初回は Docker イメージ pull で数分)
3. ルートの `.env.local.example` をコピーして `.env.local` を作成し、「ローカル Supabase 用」の値を有効化する(`cp .env.local.example .env.local`)

### migrations の適用

`cd backend && pnpm exec supabase db reset` で `000`〜`010` を番号順に再適用する。

- migration の実体は `backend/src/migrations/`。`backend/supabase/migrations` はそこへの **symlink**(supabase CLI は `supabase/migrations` 固定のため、配置を一致させずに接続している)
- `000_seed_public_schema_for_local_dev.sql` は `public."User"` / `public."DojoStyleMaster"` の最小ダミー。**ローカル専用で本番には絶対適用しない**(本番 Dashboard では 001 以降のみ実行)
- 適用後、Studio(`http://127.0.0.1:54323`)で `aikiboard` schema(23 テーブル)を確認できる

### 接続情報

`cd backend && pnpm exec supabase status` で URL・キーを確認できる(API: `54321`、DB: `54322`、Studio: `54323`)。

## 緊急リセット(ローカルのみ)

```sql
DROP SCHEMA aikiboard CASCADE;
```

`aikiboard` schema 配下のテーブル・関数・ポリシー・トリガを全削除する(`public` には影響しない)。**本番では実行しない**(forward-only 方針)。

## 注意点

- **`public."User"` / `public."DojoStyleMaster"` への FK 制約は本マイグレーションでは付与していない**。型・引用符付き識別子の差異による apply 失敗を避けるため。Phase 1 でスキーマ確認の上 `ALTER TABLE ... ADD CONSTRAINT` で追加する。
- `auth.uid()` を使った RLS ポリシーは Supabase Auth のセッション JWT 経由で評価される。バックエンド(Cloudflare Workers)は `SUPABASE_SERVICE_ROLE_KEY` で動作するため RLS をバイパスする。
- `aikiboard` schema 内のテーブルへ frontend から直接アクセスする場合は `SUPABASE_ANON_KEY` + RLS で防御層を設ける。
- フィーチャーフラグ初期データ(`plans` / `features` / `plan_features`)は `007` 末尾で INSERT 済み。料金確定後に値を更新する場合は別途 `UPDATE` または専用マイグレーションを書く。
