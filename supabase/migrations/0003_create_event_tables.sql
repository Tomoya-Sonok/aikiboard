-- 0003_create_event_tables.sql
-- 付録 A.2 稽古・出欠

-- ────────────────────────────────────────────────────────────────
-- aikiboard.events: 稽古スケジュール
-- ────────────────────────────────────────────────────────────────
CREATE TABLE aikiboard.events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  board_id UUID NOT NULL REFERENCES aikiboard.boards(id) ON DELETE CASCADE,
  start_at TIMESTAMPTZ NOT NULL,
  end_at TIMESTAMPTZ NOT NULL,
  place TEXT NOT NULL,
  instructor_name TEXT, -- 自由記述。public.users への FK にはしない(指導者は外部の方の場合もあるため)
  note TEXT,
  -- 繰り返し稽古(週次など)用。RFC5545 RRULE をテキストで保持。Phase 1 で活用
  recurrence_rule TEXT,
  is_public BOOLEAN NOT NULL DEFAULT true,
  created_by_user_id UUID NOT NULL, -- → public.users(id)、Phase 1 で FK
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT events_start_before_end CHECK (start_at < end_at)
);

CREATE INDEX idx_events_board_start ON aikiboard.events(board_id, start_at);
CREATE INDEX idx_events_board_id ON aikiboard.events(board_id);

CREATE TRIGGER trg_events_updated_at
  BEFORE UPDATE ON aikiboard.events
  FOR EACH ROW EXECUTE FUNCTION aikiboard.set_updated_at();

-- ────────────────────────────────────────────────────────────────
-- aikiboard.event_rsvps: 出欠表明
-- ────────────────────────────────────────────────────────────────
CREATE TYPE aikiboard.rsvp_status AS ENUM ('attend', 'decline');

CREATE TABLE aikiboard.event_rsvps (
  event_id UUID NOT NULL REFERENCES aikiboard.events(id) ON DELETE CASCADE,
  user_id UUID NOT NULL, -- → public.users(id)、Phase 1 で FK
  status aikiboard.rsvp_status NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (event_id, user_id)
);

CREATE INDEX idx_event_rsvps_user_id ON aikiboard.event_rsvps(user_id);

CREATE TRIGGER trg_event_rsvps_updated_at
  BEFORE UPDATE ON aikiboard.event_rsvps
  FOR EACH ROW EXECUTE FUNCTION aikiboard.set_updated_at();
