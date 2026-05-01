-- 0005_create_archive_tables.sql
-- 付録 A.4 アーカイブ(管理者のみ作成、階層構造ページ。有料プラン)

-- ────────────────────────────────────────────────────────────────
-- aikiboard.archives: 階層ページ(self-FK で親子関係を表現)
-- ────────────────────────────────────────────────────────────────
CREATE TABLE aikiboard.archives (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  board_id UUID NOT NULL REFERENCES aikiboard.boards(id) ON DELETE CASCADE,
  parent_id UUID REFERENCES aikiboard.archives(id) ON DELETE CASCADE, -- ルートは NULL
  title TEXT NOT NULL,
  body_rich JSONB NOT NULL DEFAULT '{}'::JSONB,
  order_index INTEGER NOT NULL DEFAULT 0,
  created_by_user_id UUID NOT NULL, -- → public.users(id)、Phase 1 で FK
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_archives_board_id ON aikiboard.archives(board_id);
CREATE INDEX idx_archives_parent_id ON aikiboard.archives(parent_id);
CREATE INDEX idx_archives_board_parent_order
  ON aikiboard.archives(board_id, parent_id, order_index);

CREATE TRIGGER trg_archives_updated_at
  BEFORE UPDATE ON aikiboard.archives
  FOR EACH ROW EXECUTE FUNCTION aikiboard.set_updated_at();

-- ────────────────────────────────────────────────────────────────
-- aikiboard.archive_attachments: 添付(画像/動画/AikiNote 引用)
-- ────────────────────────────────────────────────────────────────
CREATE TYPE aikiboard.archive_attachment_type AS ENUM ('image', 'video', 'aikinote_page');

CREATE TABLE aikiboard.archive_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  archive_id UUID NOT NULL REFERENCES aikiboard.archives(id) ON DELETE CASCADE,
  attachment_type aikiboard.archive_attachment_type NOT NULL,
  -- image/video の場合は URL、aikinote_page の場合は AikiNote 側 page id を URL 文字列で保持
  url TEXT NOT NULL,
  -- AikiNote ページを引用した場合、参照 ID(public.posts.id 等)を別カラムで保持
  aikinote_page_id UUID,
  metadata JSONB NOT NULL DEFAULT '{}'::JSONB,
  order_index INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_archive_attachments_archive_id
  ON aikiboard.archive_attachments(archive_id);
