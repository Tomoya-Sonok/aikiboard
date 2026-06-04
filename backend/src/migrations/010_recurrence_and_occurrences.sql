-- 0010_recurrence_and_occurrences.sql
-- 稽古カレンダー(定期稽古)の出欠を「開催日(オカレンス)単位」で扱えるようにする。
--
-- 背景:
--   定期稽古は events を「シリーズ 1 行」として保持し、recurrence_rule(RFC5545
--   サブセット)を backend で月範囲に on-the-fly 展開する方針(行数爆発を避ける)。
--   そのため出欠(event_rsvps)は (event_id, user_id) だけでは個々の開催日を区別
--   できない。occurrence_start を加えて開催日単位で記録できるようにする。
--   単発イベント(recurrence_rule = NULL)は occurrence_start = start_at とする。
--
--   さらに「この回だけ休み / この回だけ時間・場所を変更」を表現するため、例外を
--   保持する event_overrides を追加する。
--
-- 権限:
--   009 の ALTER DEFAULT PRIVILEGES(service_role)と 001(authenticated/anon)に
--   より、本ファイルで CREATE する event_overrides には権限が自動付与される。
--   よって本ファイルはテーブル作成 + RLS のみでよい。
--   forward-only(ADR 0004、down script なし)。

-- ────────────────────────────────────────────────────────────────
-- 1. event_rsvps を開催日(occurrence)単位へ拡張(PK 再構成)
-- ────────────────────────────────────────────────────────────────
-- occurrence_start を追加(まず NULL 可)。
ALTER TABLE aikiboard.event_rsvps
  ADD COLUMN IF NOT EXISTS occurrence_start TIMESTAMPTZ;

-- 既存行(すべて単発イベントへの出欠)を events.start_at で backfill。
UPDATE aikiboard.event_rsvps r
  SET occurrence_start = e.start_at
  FROM aikiboard.events e
  WHERE e.id = r.event_id
    AND r.occurrence_start IS NULL;

-- NOT NULL 化 → 旧 PK を落として (event_id, occurrence_start, user_id) で再作成。
ALTER TABLE aikiboard.event_rsvps
  ALTER COLUMN occurrence_start SET NOT NULL;

ALTER TABLE aikiboard.event_rsvps
  DROP CONSTRAINT IF EXISTS event_rsvps_pkey;

ALTER TABLE aikiboard.event_rsvps
  ADD PRIMARY KEY (event_id, occurrence_start, user_id);

-- 既存 RLS(event_rsvps_select_member / insert_self / update_self / delete_self)は
-- event_id 経由の board 判定 + user_id = auth.uid() のため、列追加・PK 変更の影響なし。

-- ────────────────────────────────────────────────────────────────
-- 2. event_overrides: 定期稽古の「この回だけ」の例外(休み / 上書き)
-- ────────────────────────────────────────────────────────────────
CREATE TABLE aikiboard.event_overrides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES aikiboard.events(id) ON DELETE CASCADE,
  -- 上書き対象のオカレンス開始時刻(アンカー。展開後の元の start に一致)。
  occurrence_start TIMESTAMPTZ NOT NULL,
  -- true = この回を休講にする(EXDATE 相当。展開結果から除外)。
  is_cancelled BOOLEAN NOT NULL DEFAULT false,
  -- 上書き値(NULL = シリーズの値を継承)。
  override_start_at TIMESTAMPTZ,
  override_end_at TIMESTAMPTZ,
  place TEXT,
  instructor_name TEXT,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- 1 オカレンスにつき例外は 1 行(upsert の競合キー)。
  CONSTRAINT event_overrides_unique_occurrence UNIQUE (event_id, occurrence_start)
);

CREATE INDEX idx_event_overrides_event_id ON aikiboard.event_overrides(event_id);

CREATE TRIGGER trg_event_overrides_updated_at
  BEFORE UPDATE ON aikiboard.event_overrides
  FOR EACH ROW EXECUTE FUNCTION aikiboard.set_updated_at();

-- ────────────────────────────────────────────────────────────────
-- 3. event_overrides の RLS(events と同方針。親 event 経由で board 判定)
-- ────────────────────────────────────────────────────────────────
ALTER TABLE aikiboard.event_overrides ENABLE ROW LEVEL SECURITY;

-- メンバーは該当イベントの例外を READ できる。
CREATE POLICY event_overrides_select_member ON aikiboard.event_overrides
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM aikiboard.events e
      WHERE e.id = event_id
        AND aikiboard.is_member_of_board(e.board_id, auth.uid())
    )
  );

-- 公開イベント(イベント自身が公開 かつ ボードが公開)は未認証も READ 可。
-- 後続の「未認証公開カレンダー」PR でカレンダー整合のために使う。
CREATE POLICY event_overrides_select_public ON aikiboard.event_overrides
  FOR SELECT TO anon, authenticated
  USING (
    EXISTS (
      SELECT 1 FROM aikiboard.events e
      WHERE e.id = event_id
        AND e.is_public = true
        AND aikiboard.is_board_public(e.board_id)
    )
  );

-- 書き込みは admin/owner のみ。
CREATE POLICY event_overrides_write_admin ON aikiboard.event_overrides
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM aikiboard.events e
      WHERE e.id = event_id
        AND aikiboard.is_admin_or_owner_of_board(e.board_id, auth.uid())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM aikiboard.events e
      WHERE e.id = event_id
        AND aikiboard.is_admin_or_owner_of_board(e.board_id, auth.uid())
    )
  );
