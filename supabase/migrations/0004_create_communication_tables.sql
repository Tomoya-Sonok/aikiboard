-- 0004_create_communication_tables.sql
-- 付録 A.3 コミュニケーション(お知らせ + フィード + スレッド)

-- ────────────────────────────────────────────────────────────────
-- aikiboard.announcements: お知らせ配信(管理者 → メンバーの一方向)
-- ────────────────────────────────────────────────────────────────
CREATE TABLE aikiboard.announcements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  board_id UUID NOT NULL REFERENCES aikiboard.boards(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  body_rich JSONB NOT NULL DEFAULT '{}'::JSONB, -- リッチテキスト(将来 ProseMirror 等)
  notify_email BOOLEAN NOT NULL DEFAULT false,
  created_by_user_id UUID NOT NULL, -- → public.users(id)、Phase 1 で FK
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_announcements_board_published
  ON aikiboard.announcements(board_id, published_at DESC);

CREATE TRIGGER trg_announcements_updated_at
  BEFORE UPDATE ON aikiboard.announcements
  FOR EACH ROW EXECUTE FUNCTION aikiboard.set_updated_at();

-- ────────────────────────────────────────────────────────────────
-- aikiboard.announcement_reads: 既読管理(per ユーザー × お知らせ)
-- ────────────────────────────────────────────────────────────────
CREATE TABLE aikiboard.announcement_reads (
  announcement_id UUID NOT NULL REFERENCES aikiboard.announcements(id) ON DELETE CASCADE,
  user_id UUID NOT NULL, -- → public.users(id)、Phase 1 で FK
  read_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (announcement_id, user_id)
);

CREATE INDEX idx_announcement_reads_user_id ON aikiboard.announcement_reads(user_id);

-- ────────────────────────────────────────────────────────────────
-- aikiboard.board_posts: 道場内フィード投稿
-- ────────────────────────────────────────────────────────────────
CREATE TABLE aikiboard.board_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  board_id UUID NOT NULL REFERENCES aikiboard.boards(id) ON DELETE CASCADE,
  author_user_id UUID NOT NULL, -- → public.users(id)、Phase 1 で FK
  body TEXT NOT NULL,
  -- AikiNote の稽古日誌を引用共有した場合の元 post id(public.posts → AikiNote 側)
  synced_from_post_id UUID,
  -- 投稿時に AikiNote にもクロスポストするかのユーザー選択(投稿時点の意思を保存)
  cross_post_to_aikinote BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_board_posts_board_created
  ON aikiboard.board_posts(board_id, created_at DESC);
CREATE INDEX idx_board_posts_author_user_id ON aikiboard.board_posts(author_user_id);

CREATE TRIGGER trg_board_posts_updated_at
  BEFORE UPDATE ON aikiboard.board_posts
  FOR EACH ROW EXECUTE FUNCTION aikiboard.set_updated_at();

-- ────────────────────────────────────────────────────────────────
-- aikiboard.board_post_attachments: 投稿の画像/動画添付
-- ────────────────────────────────────────────────────────────────
CREATE TYPE aikiboard.attachment_type AS ENUM ('image', 'video');

CREATE TABLE aikiboard.board_post_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES aikiboard.board_posts(id) ON DELETE CASCADE,
  attachment_type aikiboard.attachment_type NOT NULL,
  url TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::JSONB, -- width/height/duration 等
  order_index INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_board_post_attachments_post_id ON aikiboard.board_post_attachments(post_id);

-- ────────────────────────────────────────────────────────────────
-- aikiboard.threads: スレッド返信(投稿への返信)
-- ────────────────────────────────────────────────────────────────
CREATE TABLE aikiboard.threads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES aikiboard.board_posts(id) ON DELETE CASCADE,
  author_user_id UUID NOT NULL, -- → public.users(id)、Phase 1 で FK
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_threads_post_created ON aikiboard.threads(post_id, created_at);

CREATE TRIGGER trg_threads_updated_at
  BEFORE UPDATE ON aikiboard.threads
  FOR EACH ROW EXECUTE FUNCTION aikiboard.set_updated_at();
