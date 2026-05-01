-- 0001_create_aikiboard_schema.sql
-- AikiBoard 用スキーマの土台を作る:
--   1. `aikiboard` schema 本体
--   2. デフォルト権限(authenticated / anon / service_role)
--   3. updated_at 自動更新トリガ用の関数
--   4. RLS で使う共通ヘルパ関数(is_member_of_board / is_admin_or_owner_of_board)
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

-- ────────────────────────────────────────────────────────────────
-- 4. RLS ヘルパ関数
--    SECURITY DEFINER で実行することで、ポリシー評価時に
--    ヘルパ関数自身の権限で board_members を参照できる(再帰呼び出しの回避)。
-- ────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION aikiboard.is_member_of_board(p_board_id UUID, p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = aikiboard, public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM aikiboard.board_members
    WHERE board_id = p_board_id AND user_id = p_user_id
  );
$$;

CREATE OR REPLACE FUNCTION aikiboard.is_admin_or_owner_of_board(p_board_id UUID, p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = aikiboard, public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM aikiboard.board_members
    WHERE board_id = p_board_id AND user_id = p_user_id
      AND role IN ('owner', 'admin')
  );
$$;

CREATE OR REPLACE FUNCTION aikiboard.is_owner_of_board(p_board_id UUID, p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = aikiboard, public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM aikiboard.board_members
    WHERE board_id = p_board_id AND user_id = p_user_id
      AND role = 'owner'
  );
$$;

CREATE OR REPLACE FUNCTION aikiboard.is_board_public(p_board_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = aikiboard, public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM aikiboard.boards
    WHERE id = p_board_id AND is_public = true
  );
$$;
