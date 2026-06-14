-- 0012_invitations_multi_use.sql
-- 招待リンクを「共有リンク型(マルチユース)」へ変更する。
--
-- 背景: 002 の invitations は used_by_user_id / used_at を持つ単一使用モデルだった。
-- 道場では 1 本の招待リンク / QR を全員に配って参加してもらう運用が実態に合うため、
-- マルチユース(有効期限内なら何人でも参加可)に変更する。誰が参加したかは
-- board_members.joined_at で追えるため、単一使用用の 2 カラムは廃止する。
-- 無効化は revoked_at を立てる(soft revoke)。token は revoked_at IS NULL かつ
-- expires_at > now() のときだけ有効。
--
-- forward-only 運用。これらのカラムはまだどこからも参照されていないため DROP して安全。

ALTER TABLE aikiboard.invitations DROP COLUMN IF EXISTS used_by_user_id;
ALTER TABLE aikiboard.invitations DROP COLUMN IF EXISTS used_at;

ALTER TABLE aikiboard.invitations
  ADD COLUMN IF NOT EXISTS revoked_at TIMESTAMPTZ;

-- 任意のラベル(「2026年度 一般向け」など、複数リンクを区別する用途)。
ALTER TABLE aikiboard.invitations
  ADD COLUMN IF NOT EXISTS label TEXT;

-- 有効な招待を引く用(board_id でフィルタ + token 検索は既存 index)。
CREATE INDEX IF NOT EXISTS idx_invitations_board_active
  ON aikiboard.invitations(board_id)
  WHERE revoked_at IS NULL;
