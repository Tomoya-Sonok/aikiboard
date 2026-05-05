-- 0001_create_aikiboard_schema.sql
-- AikiBoard 用スキーマの土台を作る:
--   1. `aikiboard` schema 本体
--   2. デフォルト権限(authenticated / anon / service_role)
--   3. updated_at 自動更新トリガ用の関数
--
-- RLS で使うヘルパ関数(is_member_of_board 等)は `aikiboard.board_members`
-- 等の参照を含むため、対象テーブルが揃った段階で 0008 冒頭に定義する
-- (LANGUAGE SQL は CREATE 時点で参照テーブル存在を要求するため)。
--
-- 既存の public schema(AikiNote)には一切触らない。

-- ────────────────────────────────────────────────────────────────
-- 1. Schema
-- ────────────────────────────────────────────────────────────────
CREATE SCHEMA IF NOT EXISTS aikiboard;

-- pgcrypto は Supabase デフォルトで有効化済みだが念のため明示
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ────────────────────────────────────────────────────────────────
-- 2. 権限
-- ────────────────────────────────────────────────────────────────
GRANT USAGE ON SCHEMA aikiboard TO authenticated, anon, service_role;
GRANT ALL ON SCHEMA aikiboard TO postgres, service_role;

-- これ以降に CREATE される TABLE / SEQUENCE / FUNCTION のデフォルト権限
ALTER DEFAULT PRIVILEGES IN SCHEMA aikiboard
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA aikiboard
  GRANT USAGE, SELECT, UPDATE ON SEQUENCES TO authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA aikiboard
  GRANT SELECT ON TABLES TO anon;
ALTER DEFAULT PRIVILEGES IN SCHEMA aikiboard
  GRANT EXECUTE ON FUNCTIONS TO authenticated, anon, service_role;

-- ────────────────────────────────────────────────────────────────
-- 3. updated_at 自動更新トリガ関数
-- ────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION aikiboard.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- RLS ヘルパ関数(is_member_of_board / is_admin_or_owner_of_board /
-- is_owner_of_board / is_board_public)は 0008 冒頭で定義する。
