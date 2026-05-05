-- 0008_apply_rls.sql
-- 全テーブルに RLS を有効化し、ポリシーを宣言する。
--
-- 基本方針(要件定義 5.4):
--   - READ: ボードの board_members に該当 user_id がいる
--   - WRITE: さらに role を必要なレベル(owner / admin / member)で制限
--   - 公開ボード(boards.is_public = true)では events と board_settings のみ
--     未認証ユーザーにも READ を許可。他のテーブルは公開ボードでも認証必須。
--   - service_role は RLS をバイパスする(バックエンドは常にバイパス)。

-- ────────────────────────────────────────────────────────────────
-- 0. RLS ヘルパ関数
--    LANGUAGE SQL は CREATE 時点で参照テーブルの存在を要求するため、
--    aikiboard.board_members / boards が揃っている本ファイル冒頭で定義する。
--    SECURITY DEFINER により、ポリシー評価時にヘルパ関数自身の権限で
--    board_members を参照できる(RLS の再帰呼び出しを回避)。
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

-- ────────────────────────────────────────────────────────────────
-- aikiboard.boards
-- ────────────────────────────────────────────────────────────────
ALTER TABLE aikiboard.boards ENABLE ROW LEVEL SECURITY;

CREATE POLICY boards_select_member ON aikiboard.boards
  FOR SELECT TO authenticated
  USING (aikiboard.is_member_of_board(id, auth.uid()));

CREATE POLICY boards_select_public ON aikiboard.boards
  FOR SELECT TO anon, authenticated
  USING (is_public = true);

CREATE POLICY boards_insert_self ON aikiboard.boards
  FOR INSERT TO authenticated
  WITH CHECK (created_by_user_id = auth.uid());

CREATE POLICY boards_update_admin ON aikiboard.boards
  FOR UPDATE TO authenticated
  USING (aikiboard.is_admin_or_owner_of_board(id, auth.uid()));

CREATE POLICY boards_delete_owner ON aikiboard.boards
  FOR DELETE TO authenticated
  USING (aikiboard.is_owner_of_board(id, auth.uid()));

-- ────────────────────────────────────────────────────────────────
-- aikiboard.board_settings(公開ボードは未認証 READ も可)
-- ────────────────────────────────────────────────────────────────
ALTER TABLE aikiboard.board_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY board_settings_select_member ON aikiboard.board_settings
  FOR SELECT TO authenticated
  USING (aikiboard.is_member_of_board(board_id, auth.uid()));

CREATE POLICY board_settings_select_public ON aikiboard.board_settings
  FOR SELECT TO anon, authenticated
  USING (aikiboard.is_board_public(board_id));

CREATE POLICY board_settings_insert_admin ON aikiboard.board_settings
  FOR INSERT TO authenticated
  WITH CHECK (aikiboard.is_admin_or_owner_of_board(board_id, auth.uid()));

CREATE POLICY board_settings_update_admin ON aikiboard.board_settings
  FOR UPDATE TO authenticated
  USING (aikiboard.is_admin_or_owner_of_board(board_id, auth.uid()));

CREATE POLICY board_settings_delete_admin ON aikiboard.board_settings
  FOR DELETE TO authenticated
  USING (aikiboard.is_admin_or_owner_of_board(board_id, auth.uid()));

-- ────────────────────────────────────────────────────────────────
-- aikiboard.board_members
-- ────────────────────────────────────────────────────────────────
ALTER TABLE aikiboard.board_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY board_members_select_member ON aikiboard.board_members
  FOR SELECT TO authenticated
  USING (aikiboard.is_member_of_board(board_id, auth.uid()));

CREATE POLICY board_members_insert_admin ON aikiboard.board_members
  FOR INSERT TO authenticated
  WITH CHECK (aikiboard.is_admin_or_owner_of_board(board_id, auth.uid()));

CREATE POLICY board_members_update_admin ON aikiboard.board_members
  FOR UPDATE TO authenticated
  USING (aikiboard.is_admin_or_owner_of_board(board_id, auth.uid()));

-- 退会(自身の board_members 削除)は本人 OR admin/owner 経由
CREATE POLICY board_members_delete_self_or_admin ON aikiboard.board_members
  FOR DELETE TO authenticated
  USING (
    user_id = auth.uid()
    OR aikiboard.is_admin_or_owner_of_board(board_id, auth.uid())
  );

-- ────────────────────────────────────────────────────────────────
-- aikiboard.board_dojo_masters
-- ────────────────────────────────────────────────────────────────
ALTER TABLE aikiboard.board_dojo_masters ENABLE ROW LEVEL SECURITY;

CREATE POLICY board_dojo_masters_select_member ON aikiboard.board_dojo_masters
  FOR SELECT TO authenticated
  USING (aikiboard.is_member_of_board(board_id, auth.uid()));

CREATE POLICY board_dojo_masters_write_admin ON aikiboard.board_dojo_masters
  FOR ALL TO authenticated
  USING (aikiboard.is_admin_or_owner_of_board(board_id, auth.uid()))
  WITH CHECK (aikiboard.is_admin_or_owner_of_board(board_id, auth.uid()));

-- ────────────────────────────────────────────────────────────────
-- aikiboard.invitations
-- ────────────────────────────────────────────────────────────────
ALTER TABLE aikiboard.invitations ENABLE ROW LEVEL SECURITY;

CREATE POLICY invitations_select_admin ON aikiboard.invitations
  FOR SELECT TO authenticated
  USING (aikiboard.is_admin_or_owner_of_board(board_id, auth.uid()));

CREATE POLICY invitations_write_admin ON aikiboard.invitations
  FOR ALL TO authenticated
  USING (aikiboard.is_admin_or_owner_of_board(board_id, auth.uid()))
  WITH CHECK (aikiboard.is_admin_or_owner_of_board(board_id, auth.uid()));

-- ────────────────────────────────────────────────────────────────
-- aikiboard.activity_logs(有料機能。閲覧は admin/owner のみ)
-- ────────────────────────────────────────────────────────────────
ALTER TABLE aikiboard.activity_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY activity_logs_select_admin ON aikiboard.activity_logs
  FOR SELECT TO authenticated
  USING (aikiboard.is_admin_or_owner_of_board(board_id, auth.uid()));

-- 書き込みはアプリ層(service_role)からのみ。authenticated への INSERT は禁止する。
-- service_role は RLS をバイパスするので、特別なポリシー宣言は不要。

-- ────────────────────────────────────────────────────────────────
-- aikiboard.events(公開ボードは未認証 READ 可)
-- ────────────────────────────────────────────────────────────────
ALTER TABLE aikiboard.events ENABLE ROW LEVEL SECURITY;

CREATE POLICY events_select_member ON aikiboard.events
  FOR SELECT TO authenticated
  USING (aikiboard.is_member_of_board(board_id, auth.uid()));

CREATE POLICY events_select_public ON aikiboard.events
  FOR SELECT TO anon, authenticated
  USING (is_public = true AND aikiboard.is_board_public(board_id));

CREATE POLICY events_write_admin ON aikiboard.events
  FOR ALL TO authenticated
  USING (aikiboard.is_admin_or_owner_of_board(board_id, auth.uid()))
  WITH CHECK (aikiboard.is_admin_or_owner_of_board(board_id, auth.uid()));

-- ────────────────────────────────────────────────────────────────
-- aikiboard.event_rsvps(自身の出欠は自分で管理、参加者一覧はメンバー全員が閲覧)
-- ────────────────────────────────────────────────────────────────
ALTER TABLE aikiboard.event_rsvps ENABLE ROW LEVEL SECURITY;

CREATE POLICY event_rsvps_select_member ON aikiboard.event_rsvps
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM aikiboard.events e
      WHERE e.id = event_id
        AND aikiboard.is_member_of_board(e.board_id, auth.uid())
    )
  );

CREATE POLICY event_rsvps_insert_self ON aikiboard.event_rsvps
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM aikiboard.events e
      WHERE e.id = event_id
        AND aikiboard.is_member_of_board(e.board_id, auth.uid())
    )
  );

CREATE POLICY event_rsvps_update_self ON aikiboard.event_rsvps
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY event_rsvps_delete_self ON aikiboard.event_rsvps
  FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- ────────────────────────────────────────────────────────────────
-- aikiboard.announcements
-- ────────────────────────────────────────────────────────────────
ALTER TABLE aikiboard.announcements ENABLE ROW LEVEL SECURITY;

CREATE POLICY announcements_select_member ON aikiboard.announcements
  FOR SELECT TO authenticated
  USING (aikiboard.is_member_of_board(board_id, auth.uid()));

CREATE POLICY announcements_write_admin ON aikiboard.announcements
  FOR ALL TO authenticated
  USING (aikiboard.is_admin_or_owner_of_board(board_id, auth.uid()))
  WITH CHECK (aikiboard.is_admin_or_owner_of_board(board_id, auth.uid()));

-- ────────────────────────────────────────────────────────────────
-- aikiboard.announcement_reads(自分の既読のみ自分で管理)
-- ────────────────────────────────────────────────────────────────
ALTER TABLE aikiboard.announcement_reads ENABLE ROW LEVEL SECURITY;

CREATE POLICY announcement_reads_select_self ON aikiboard.announcement_reads
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY announcement_reads_insert_self ON aikiboard.announcement_reads
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY announcement_reads_delete_self ON aikiboard.announcement_reads
  FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- ────────────────────────────────────────────────────────────────
-- aikiboard.board_posts
-- ────────────────────────────────────────────────────────────────
ALTER TABLE aikiboard.board_posts ENABLE ROW LEVEL SECURITY;

CREATE POLICY board_posts_select_member ON aikiboard.board_posts
  FOR SELECT TO authenticated
  USING (aikiboard.is_member_of_board(board_id, auth.uid()));

CREATE POLICY board_posts_insert_member ON aikiboard.board_posts
  FOR INSERT TO authenticated
  WITH CHECK (
    author_user_id = auth.uid()
    AND aikiboard.is_member_of_board(board_id, auth.uid())
  );

CREATE POLICY board_posts_update_self_or_admin ON aikiboard.board_posts
  FOR UPDATE TO authenticated
  USING (
    author_user_id = auth.uid()
    OR aikiboard.is_admin_or_owner_of_board(board_id, auth.uid())
  );

CREATE POLICY board_posts_delete_self_or_admin ON aikiboard.board_posts
  FOR DELETE TO authenticated
  USING (
    author_user_id = auth.uid()
    OR aikiboard.is_admin_or_owner_of_board(board_id, auth.uid())
  );

-- ────────────────────────────────────────────────────────────────
-- aikiboard.board_post_attachments(親 post と同じ権限で扱う)
-- ────────────────────────────────────────────────────────────────
ALTER TABLE aikiboard.board_post_attachments ENABLE ROW LEVEL SECURITY;

CREATE POLICY board_post_attachments_select_member ON aikiboard.board_post_attachments
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM aikiboard.board_posts p
      WHERE p.id = post_id
        AND aikiboard.is_member_of_board(p.board_id, auth.uid())
    )
  );

CREATE POLICY board_post_attachments_write_self_or_admin ON aikiboard.board_post_attachments
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM aikiboard.board_posts p
      WHERE p.id = post_id
        AND (
          p.author_user_id = auth.uid()
          OR aikiboard.is_admin_or_owner_of_board(p.board_id, auth.uid())
        )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM aikiboard.board_posts p
      WHERE p.id = post_id
        AND (
          p.author_user_id = auth.uid()
          OR aikiboard.is_admin_or_owner_of_board(p.board_id, auth.uid())
        )
    )
  );

-- ────────────────────────────────────────────────────────────────
-- aikiboard.threads
-- ────────────────────────────────────────────────────────────────
ALTER TABLE aikiboard.threads ENABLE ROW LEVEL SECURITY;

CREATE POLICY threads_select_member ON aikiboard.threads
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM aikiboard.board_posts p
      WHERE p.id = post_id
        AND aikiboard.is_member_of_board(p.board_id, auth.uid())
    )
  );

CREATE POLICY threads_insert_member ON aikiboard.threads
  FOR INSERT TO authenticated
  WITH CHECK (
    author_user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM aikiboard.board_posts p
      WHERE p.id = post_id
        AND aikiboard.is_member_of_board(p.board_id, auth.uid())
    )
  );

CREATE POLICY threads_update_self_or_admin ON aikiboard.threads
  FOR UPDATE TO authenticated
  USING (
    author_user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM aikiboard.board_posts p
      WHERE p.id = post_id
        AND aikiboard.is_admin_or_owner_of_board(p.board_id, auth.uid())
    )
  );

CREATE POLICY threads_delete_self_or_admin ON aikiboard.threads
  FOR DELETE TO authenticated
  USING (
    author_user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM aikiboard.board_posts p
      WHERE p.id = post_id
        AND aikiboard.is_admin_or_owner_of_board(p.board_id, auth.uid())
    )
  );

-- ────────────────────────────────────────────────────────────────
-- aikiboard.archives(有料機能、閲覧は全メンバー、書き込みは admin/owner のみ)
-- ────────────────────────────────────────────────────────────────
ALTER TABLE aikiboard.archives ENABLE ROW LEVEL SECURITY;

CREATE POLICY archives_select_member ON aikiboard.archives
  FOR SELECT TO authenticated
  USING (aikiboard.is_member_of_board(board_id, auth.uid()));

CREATE POLICY archives_write_admin ON aikiboard.archives
  FOR ALL TO authenticated
  USING (aikiboard.is_admin_or_owner_of_board(board_id, auth.uid()))
  WITH CHECK (aikiboard.is_admin_or_owner_of_board(board_id, auth.uid()));

-- ────────────────────────────────────────────────────────────────
-- aikiboard.archive_attachments(親 archive と同じ権限)
-- ────────────────────────────────────────────────────────────────
ALTER TABLE aikiboard.archive_attachments ENABLE ROW LEVEL SECURITY;

CREATE POLICY archive_attachments_select_member ON aikiboard.archive_attachments
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM aikiboard.archives a
      WHERE a.id = archive_id
        AND aikiboard.is_member_of_board(a.board_id, auth.uid())
    )
  );

CREATE POLICY archive_attachments_write_admin ON aikiboard.archive_attachments
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM aikiboard.archives a
      WHERE a.id = archive_id
        AND aikiboard.is_admin_or_owner_of_board(a.board_id, auth.uid())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM aikiboard.archives a
      WHERE a.id = archive_id
        AND aikiboard.is_admin_or_owner_of_board(a.board_id, auth.uid())
    )
  );

-- ────────────────────────────────────────────────────────────────
-- aikiboard.member_fees(会計、admin/owner のみ閲覧 + 書き込み)
-- ────────────────────────────────────────────────────────────────
ALTER TABLE aikiboard.member_fees ENABLE ROW LEVEL SECURITY;

CREATE POLICY member_fees_admin ON aikiboard.member_fees
  FOR ALL TO authenticated
  USING (aikiboard.is_admin_or_owner_of_board(board_id, auth.uid()))
  WITH CHECK (aikiboard.is_admin_or_owner_of_board(board_id, auth.uid()));

-- ────────────────────────────────────────────────────────────────
-- aikiboard.fee_payments(admin/owner OR 自身の支払いは閲覧可)
-- ────────────────────────────────────────────────────────────────
ALTER TABLE aikiboard.fee_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY fee_payments_select_admin_or_self ON aikiboard.fee_payments
  FOR SELECT TO authenticated
  USING (
    aikiboard.is_admin_or_owner_of_board(board_id, auth.uid())
    OR user_id = auth.uid()
  );

CREATE POLICY fee_payments_write_admin ON aikiboard.fee_payments
  FOR INSERT TO authenticated
  WITH CHECK (aikiboard.is_admin_or_owner_of_board(board_id, auth.uid()));

CREATE POLICY fee_payments_update_admin ON aikiboard.fee_payments
  FOR UPDATE TO authenticated
  USING (aikiboard.is_admin_or_owner_of_board(board_id, auth.uid()));

CREATE POLICY fee_payments_delete_admin ON aikiboard.fee_payments
  FOR DELETE TO authenticated
  USING (aikiboard.is_admin_or_owner_of_board(board_id, auth.uid()));

-- ────────────────────────────────────────────────────────────────
-- aikiboard.expense_entries(会計、admin/owner のみ)
-- ────────────────────────────────────────────────────────────────
ALTER TABLE aikiboard.expense_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY expense_entries_admin ON aikiboard.expense_entries
  FOR ALL TO authenticated
  USING (aikiboard.is_admin_or_owner_of_board(board_id, auth.uid()))
  WITH CHECK (aikiboard.is_admin_or_owner_of_board(board_id, auth.uid()));

-- ────────────────────────────────────────────────────────────────
-- aikiboard.plans / features / plan_features(全ユーザーが閲覧可、書き込みは service_role のみ)
-- ────────────────────────────────────────────────────────────────
ALTER TABLE aikiboard.plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE aikiboard.features ENABLE ROW LEVEL SECURITY;
ALTER TABLE aikiboard.plan_features ENABLE ROW LEVEL SECURITY;

CREATE POLICY plans_select_all ON aikiboard.plans
  FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY features_select_all ON aikiboard.features
  FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY plan_features_select_all ON aikiboard.plan_features
  FOR SELECT TO anon, authenticated USING (true);

-- INSERT/UPDATE/DELETE は service_role のみ(マイグレーション or バックエンド経由)。
-- service_role は RLS をバイパスするので、authenticated 用の WRITE ポリシーは作らない。

-- ────────────────────────────────────────────────────────────────
-- aikiboard.board_subscriptions(admin/owner が閲覧、書き込みは service_role のみ)
-- ────────────────────────────────────────────────────────────────
ALTER TABLE aikiboard.board_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY board_subscriptions_select_admin ON aikiboard.board_subscriptions
  FOR SELECT TO authenticated
  USING (aikiboard.is_admin_or_owner_of_board(board_id, auth.uid()));

-- INSERT/UPDATE/DELETE は service_role のみ(Stripe webhook 経由でアプリが書き込む)。
