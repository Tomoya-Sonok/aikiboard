-- 0013_membership_requests.sql
-- AikiNote 道場データからの参加申請(要件 4.5.2)。
--
-- AikiNote ユーザーは public."User".dojo_style_id で 1 つの道場(DojoStyleMaster)に
-- 紐づく。その道場に紐づくボード(board_dojo_masters)を見つけて参加申請でき、
-- 管理者が承認すると board_members に追加される。承認待ち/承認/却下を本テーブルで管理する。

CREATE TYPE aikiboard.membership_request_status AS ENUM (
  'pending',
  'approved',
  'rejected'
);

CREATE TABLE aikiboard.membership_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  board_id UUID NOT NULL REFERENCES aikiboard.boards(id) ON DELETE CASCADE,
  user_id UUID NOT NULL, -- 申請者 → public."User"(id)、Phase 1 で FK
  status aikiboard.membership_request_status NOT NULL DEFAULT 'pending',
  message TEXT, -- 申請時の一言(任意)
  decided_by_user_id UUID, -- 承認/却下した管理者 → public."User"(id)
  decided_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_membership_requests_board_status
  ON aikiboard.membership_requests(board_id, status);
CREATE INDEX idx_membership_requests_user_id
  ON aikiboard.membership_requests(user_id);

-- 同一ボードへの「承認待ち」重複申請を防ぐ(却下後の再申請は許可)。
CREATE UNIQUE INDEX idx_membership_requests_one_pending
  ON aikiboard.membership_requests(board_id, user_id)
  WHERE status = 'pending';

CREATE TRIGGER trg_membership_requests_updated_at
  BEFORE UPDATE ON aikiboard.membership_requests
  FOR EACH ROW EXECUTE FUNCTION aikiboard.set_updated_at();

-- ────────────────────────────────────────────────────────────────
-- RLS: 申請者は自分の申請、管理者はボードの申請を閲覧。作成は本人、判定は管理者。
-- (backend は service_role でバイパス。RLS は anon/authenticated 直アクセスの防御層)
-- ────────────────────────────────────────────────────────────────
ALTER TABLE aikiboard.membership_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY membership_requests_select_self_or_admin ON aikiboard.membership_requests
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR aikiboard.is_admin_or_owner_of_board(board_id, auth.uid())
  );

CREATE POLICY membership_requests_insert_self ON aikiboard.membership_requests
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY membership_requests_update_admin ON aikiboard.membership_requests
  FOR UPDATE TO authenticated
  USING (aikiboard.is_admin_or_owner_of_board(board_id, auth.uid()))
  WITH CHECK (aikiboard.is_admin_or_owner_of_board(board_id, auth.uid()));
