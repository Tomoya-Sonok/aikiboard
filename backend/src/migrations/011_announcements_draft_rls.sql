-- 0011_announcements_draft_rls.sql
-- お知らせ「下書き」(published_at IS NULL)の RLS 防御を強化する。
--
-- 背景: 008 の announcements_select_member は board_members の所属だけで SELECT を許し、
-- 公開状態を区別していなかった。backend は service_role で動くため実害は無いが、
-- frontend が anon キーで直接 aikiboard を読む経路(防御層の RLS)では、一般メンバーに
-- 未公開の下書きが見えてしまう。下書きは管理者(owner/admin)のみ閲覧可とする方針に合わせ、
-- 「メンバー かつ(公開済み OR 管理者)」へ絞り直す。
--
-- あわせて announcement_reads の INSERT を「対象お知らせが公開済み、かつ自分がその
-- ボードのメンバー」に限定し、任意 UUID に対するゴミ既読行の作成を防ぐ。
-- forward-only 運用のため、既存ポリシーを DROP して作り直す。

-- ────────────────────────────────────────────────────────────────
-- announcements: member かつ(公開済み OR 管理者)
-- ────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS announcements_select_member ON aikiboard.announcements;

CREATE POLICY announcements_select_member ON aikiboard.announcements
  FOR SELECT TO authenticated
  USING (
    aikiboard.is_member_of_board(board_id, auth.uid())
    AND (
      published_at IS NOT NULL
      OR aikiboard.is_admin_or_owner_of_board(board_id, auth.uid())
    )
  );

-- ────────────────────────────────────────────────────────────────
-- announcement_reads: 自分の既読 INSERT を「公開済み + 自分がメンバー」に限定
-- ────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS announcement_reads_insert_self ON aikiboard.announcement_reads;

CREATE POLICY announcement_reads_insert_self ON aikiboard.announcement_reads
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM aikiboard.announcements a
      WHERE a.id = announcement_id
        AND a.published_at IS NOT NULL
        AND aikiboard.is_member_of_board(a.board_id, auth.uid())
    )
  );
