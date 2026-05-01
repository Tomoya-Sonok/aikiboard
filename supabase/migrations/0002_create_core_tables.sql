-- 0002_create_core_tables.sql
-- 付録 A.1 コア(ボード本体・メンバー・道場マスタ紐付け・招待・ログ)。
--
-- 注意: public.users(id) / public.DojoStyleMaster(id) への FK は型・引用符の
-- 差異で apply が失敗するリスクがあるため、Phase 0 では付与しない。
-- 該当カラムは UUID 型で、AikiNote 側の id を保持する想定。Phase 1 で
-- スキーマ確認後に ALTER TABLE ... ADD CONSTRAINT で追加する。

-- ────────────────────────────────────────────────────────────────
-- aikiboard.boards: ボード本体(=道場)
-- ────────────────────────────────────────────────────────────────
CREATE TABLE aikiboard.boards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  created_by_user_id UUID NOT NULL, -- → public.users(id)、Phase 1 で FK
  is_public BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_boards_created_by_user_id ON aikiboard.boards(created_by_user_id);
CREATE INDEX idx_boards_is_public ON aikiboard.boards(is_public) WHERE is_public = true;

CREATE TRIGGER trg_boards_updated_at
  BEFORE UPDATE ON aikiboard.boards
  FOR EACH ROW EXECUTE FUNCTION aikiboard.set_updated_at();

-- ────────────────────────────────────────────────────────────────
-- aikiboard.board_settings: ボード詳細設定(1:1)
-- ────────────────────────────────────────────────────────────────
CREATE TABLE aikiboard.board_settings (
  board_id UUID PRIMARY KEY REFERENCES aikiboard.boards(id) ON DELETE CASCADE,
  logo_url TEXT,
  -- 10 色プリセットの code (sumi/dou/fukamidori/ai/enji/yamabuki/shikon/toki/usuzumi/nezumi)
  theme_color_code TEXT NOT NULL DEFAULT 'sumi',
  description TEXT,
  -- 公開ページの表示項目設定(指導者紹介の表示有無、見学申し込みフォーム ON/OFF 等)
  public_page_config JSONB NOT NULL DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER trg_board_settings_updated_at
  BEFORE UPDATE ON aikiboard.board_settings
  FOR EACH ROW EXECUTE FUNCTION aikiboard.set_updated_at();

-- ────────────────────────────────────────────────────────────────
-- aikiboard.board_members: ボード所属とロール
-- ────────────────────────────────────────────────────────────────
CREATE TYPE aikiboard.board_member_role AS ENUM ('owner', 'admin', 'member');

CREATE TABLE aikiboard.board_members (
  board_id UUID NOT NULL REFERENCES aikiboard.boards(id) ON DELETE CASCADE,
  user_id UUID NOT NULL, -- → public.users(id)、Phase 1 で FK
  role aikiboard.board_member_role NOT NULL DEFAULT 'member',
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (board_id, user_id)
);

CREATE INDEX idx_board_members_user_id ON aikiboard.board_members(user_id);
CREATE INDEX idx_board_members_board_role ON aikiboard.board_members(board_id, role);

-- ボード 1 つに owner は 1 名のみ
CREATE UNIQUE INDEX idx_board_members_one_owner
  ON aikiboard.board_members(board_id) WHERE role = 'owner';

-- ────────────────────────────────────────────────────────────────
-- aikiboard.board_dojo_masters: ボード × 道場マスタ(N:M)
--   AikiNote の public.DojoStyleMaster への紐付け。最低 1 件必須。
-- ────────────────────────────────────────────────────────────────
CREATE TABLE aikiboard.board_dojo_masters (
  board_id UUID NOT NULL REFERENCES aikiboard.boards(id) ON DELETE CASCADE,
  dojo_master_id UUID NOT NULL, -- → public."DojoStyleMaster"(id)、Phase 1 で FK
  is_primary BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (board_id, dojo_master_id)
);

-- 各 board の primary 道場は 1 件のみ
CREATE UNIQUE INDEX idx_board_dojo_masters_primary
  ON aikiboard.board_dojo_masters(board_id) WHERE is_primary;

-- ────────────────────────────────────────────────────────────────
-- aikiboard.invitations: 招待リンク
-- ────────────────────────────────────────────────────────────────
CREATE TABLE aikiboard.invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  board_id UUID NOT NULL REFERENCES aikiboard.boards(id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  used_by_user_id UUID, -- → public.users(id)、Phase 1 で FK
  used_at TIMESTAMPTZ,
  created_by_user_id UUID NOT NULL, -- → public.users(id)、Phase 1 で FK
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_invitations_board_id ON aikiboard.invitations(board_id);
CREATE INDEX idx_invitations_token ON aikiboard.invitations(token);

-- ────────────────────────────────────────────────────────────────
-- aikiboard.activity_logs: 操作履歴(管理者のみ閲覧可能、有料機能)
-- ────────────────────────────────────────────────────────────────
CREATE TABLE aikiboard.activity_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  board_id UUID NOT NULL REFERENCES aikiboard.boards(id) ON DELETE CASCADE,
  user_id UUID, -- → public.users(id)。退会で SET NULL 想定。Phase 1 で FK
  action TEXT NOT NULL, -- "event.created", "rsvp.attend", "announce.posted" 等
  target_type TEXT, -- "event", "announcement", "post" 等
  target_id UUID,
  metadata JSONB NOT NULL DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_activity_logs_board_created
  ON aikiboard.activity_logs(board_id, created_at DESC);
