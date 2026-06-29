-- 0015_create_notifications.sql
-- アプリ内通知(要件 4.9)。ボードスコープ。お知らせ公開・フィード投稿・スレッド返信・
-- 稽古作成などのイベントで、受信者ごとに 1 行作る。
--
-- 表示に必要な情報(actor 名・タイトル抜粋)は metadata に非正規化して保存し、一覧取得時の
-- JOIN を避ける(高速・シンプル)。リンク先は type + target で frontend が解決する。
--
-- 書き込みはアプリ層(service_role)からのみ。受信者本人だけが自分の通知を read/更新できる。

CREATE TABLE aikiboard.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  board_id UUID NOT NULL REFERENCES aikiboard.boards(id) ON DELETE CASCADE,
  recipient_user_id UUID NOT NULL, -- → public."User"(id)
  actor_user_id UUID,              -- 行動者(システム発の場合 NULL)
  -- "announcement.published" / "post.created" / "thread.replied" / "event.created"
  type TEXT NOT NULL,
  target_type TEXT,                -- "announcement" / "post" / "event"
  target_id UUID,
  -- { actorName, title } 等を非正規化(一覧の JOIN 回避)。
  metadata JSONB NOT NULL DEFAULT '{}'::JSONB,
  is_read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_notifications_recipient
  ON aikiboard.notifications(recipient_user_id, is_read, created_at DESC);
CREATE INDEX idx_notifications_board ON aikiboard.notifications(board_id);

-- ────────────────────────────────────────────────────────────────
-- RLS: 受信者本人のみ閲覧/更新/削除。INSERT は service_role のみ(アプリ層)。
-- ────────────────────────────────────────────────────────────────
ALTER TABLE aikiboard.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY notifications_select_self ON aikiboard.notifications
  FOR SELECT TO authenticated
  USING (recipient_user_id = auth.uid());

CREATE POLICY notifications_update_self ON aikiboard.notifications
  FOR UPDATE TO authenticated
  USING (recipient_user_id = auth.uid());

CREATE POLICY notifications_delete_self ON aikiboard.notifications
  FOR DELETE TO authenticated
  USING (recipient_user_id = auth.uid());

-- INSERT は service_role のみ。service_role は RLS をバイパスするので追加ポリシーは不要。
