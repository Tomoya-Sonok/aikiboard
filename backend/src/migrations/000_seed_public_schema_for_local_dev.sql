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
  is_approved BOOLEAN NOT NULL DEFAULT false,
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
-- ダミーデータ（固定 UUID で開発時に参照しやすくする）
-- ────────────────────────────────────────────────────────────────
INSERT INTO public."DojoStyleMaster" (id, dojo_name, dojo_name_kana, is_approved)
VALUES
  ('00000000-0000-0000-0000-000000000001', '合気会本部道場', 'あいきかいほんぶどうじょう', true),
  ('00000000-0000-0000-0000-000000000002', '養神館本部道場', 'ようしんかんほんぶどうじょう', true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public."User" (id, email, username, dojo_style_id)
VALUES
  ('11111111-1111-1111-1111-111111111111', 'dev-owner@example.com', 'dev_owner', '00000000-0000-0000-0000-000000000001'),
  ('22222222-2222-2222-2222-222222222222', 'dev-member@example.com', 'dev_member', '00000000-0000-0000-0000-000000000001')
ON CONFLICT (id) DO NOTHING;
