-- 000_seed_public_schema_for_local_dev.sql
--
-- ⚠️⚠️⚠️ ローカル開発専用。本番には絶対に適用しないこと。 ⚠️⚠️⚠️
--
-- AikiBoard は本番では AikiNote と同一 Supabase プロジェクトを共有し、
-- public."User" / public."DojoStyleMaster" は AikiNote 側が管理している。
-- 本ファイルは、それらが存在しないローカル Supabase コンテナ上で
-- AikiBoard の開発（ボード作成・道場紐付け 等）を回せるよう、
-- 最小ダミーを再現するための seed である。
--
-- 本番適用（Supabase Dashboard SQL Editor）では 001 以降のみを流し、
-- この 000 は決して実行しない（実行すると AikiNote の実テーブルと衝突する）。
-- db reset（ローカル）でのみ番号順の先頭として適用される。

-- ────────────────────────────────────────────────────────────────
-- public."DojoStyleMaster": AikiNote 道場マスタの最小再現
--   AikiBoard の board_dojo_masters.dojo_master_id が参照する。
-- ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public."DojoStyleMaster" (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dojo_name TEXT NOT NULL UNIQUE,
  dojo_name_kana TEXT,
  -- AikiNote 実テーブルに合わせる(新規追加 = 双方向書き込み 5.2 で利用)。
  region TEXT,
  is_approved BOOLEAN NOT NULL DEFAULT false,
  created_by_user_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ────────────────────────────────────────────────────────────────
-- public."User": AikiNote ユーザーの最小再現
--   id は Supabase Auth の auth.users.id に対応する想定。
--   AikiBoard の created_by_user_id / user_id 系が参照する。
-- ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public."User" (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT,
  username TEXT NOT NULL,
  profile_image_url TEXT,
  dojo_style_id UUID REFERENCES public."DojoStyleMaster"(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ────────────────────────────────────────────────────────────────
-- public."SocialPost": AikiNote フィード(SocialPost)の最小再現
--   AikiBoard の フィード連携(引用共有 5.3.2 / クロスポスト 5.3.1)の読み書き先。
--   本番は AikiNote 側が管理する実テーブル。ここはローカルで連携を回すための最小列のみ。
-- ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public."SocialPost" (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  content TEXT NOT NULL,
  post_type TEXT NOT NULL DEFAULT 'post',
  visibility TEXT NOT NULL DEFAULT 'public',
  author_dojo_style_id UUID,
  author_dojo_name TEXT,
  is_deleted BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ────────────────────────────────────────────────────────────────
-- ダミーデータ（固定 UUID で開発時に参照しやすくする）
-- ────────────────────────────────────────────────────────────────
INSERT INTO public."DojoStyleMaster" (id, dojo_name, dojo_name_kana, is_approved)
VALUES
  ('00000000-0000-0000-0000-000000000001', '蕨合気道会', 'わらびあいきどうかい', true),
  ('00000000-0000-0000-0000-000000000002', '初心会', 'しょしんかい', true)
ON CONFLICT (id) DO NOTHING;

-- public."User" の dev ユーザー(プロフィール行)は、Supabase Auth の auth.users と id を
-- 一致させる必要があるため、ここでは作らず seed スクリプトで投入する:
--   `pnpm -C backend seed:dev`(Admin API で auth ユーザー作成 → public."User" upsert →
--    ボード「蕨合気道会」+ サンプル稽古を作成)。ログイン情報は docs/development-guide.md 参照。
