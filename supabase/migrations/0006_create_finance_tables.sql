-- 0006_create_finance_tables.sql
-- 付録 A.5 会計(管理者のみ閲覧、有料プラン。決済はオフライン前提、ステータス管理 + 収支可視化)

-- ────────────────────────────────────────────────────────────────
-- aikiboard.member_fees: メンバー別月謝設定
--   各メンバーの月額。無料体験中などで途中変更が発生するため effective_from で履歴を残す。
-- ────────────────────────────────────────────────────────────────
CREATE TABLE aikiboard.member_fees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  board_id UUID NOT NULL REFERENCES aikiboard.boards(id) ON DELETE CASCADE,
  user_id UUID NOT NULL, -- → public.users(id)、Phase 1 で FK
  monthly_fee INTEGER NOT NULL CHECK (monthly_fee >= 0),
  effective_from DATE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (board_id, user_id, effective_from)
);

CREATE INDEX idx_member_fees_board_user ON aikiboard.member_fees(board_id, user_id);

CREATE TRIGGER trg_member_fees_updated_at
  BEFORE UPDATE ON aikiboard.member_fees
  FOR EACH ROW EXECUTE FUNCTION aikiboard.set_updated_at();

-- ────────────────────────────────────────────────────────────────
-- aikiboard.fee_payments: 月謝支払いステータス(年月単位)
-- ────────────────────────────────────────────────────────────────
CREATE TYPE aikiboard.fee_payment_status AS ENUM ('paid', 'unpaid', 'waived');

CREATE TABLE aikiboard.fee_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  board_id UUID NOT NULL REFERENCES aikiboard.boards(id) ON DELETE CASCADE,
  user_id UUID NOT NULL, -- → public.users(id)、Phase 1 で FK
  -- 'YYYYMM' 6 文字、例: '202607'
  period_yyyymm TEXT NOT NULL CHECK (period_yyyymm ~ '^[0-9]{6}$'),
  status aikiboard.fee_payment_status NOT NULL DEFAULT 'unpaid',
  paid_at TIMESTAMPTZ,
  amount INTEGER, -- 支払時点の月謝額(member_fees から推測されるが履歴用に保存)
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (board_id, user_id, period_yyyymm)
);

CREATE INDEX idx_fee_payments_board_period ON aikiboard.fee_payments(board_id, period_yyyymm);
CREATE INDEX idx_fee_payments_user_id ON aikiboard.fee_payments(user_id);

CREATE TRIGGER trg_fee_payments_updated_at
  BEFORE UPDATE ON aikiboard.fee_payments
  FOR EACH ROW EXECUTE FUNCTION aikiboard.set_updated_at();

-- ────────────────────────────────────────────────────────────────
-- aikiboard.expense_entries: 支出記録(備品購入・場所代等)
-- ────────────────────────────────────────────────────────────────
CREATE TABLE aikiboard.expense_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  board_id UUID NOT NULL REFERENCES aikiboard.boards(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  category TEXT NOT NULL, -- 'venue', 'equipment', 'other' 等。詳細仕様は Phase 1 で確定
  amount INTEGER NOT NULL CHECK (amount >= 0),
  note TEXT,
  created_by_user_id UUID NOT NULL, -- → public.users(id)、Phase 1 で FK
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_expense_entries_board_date
  ON aikiboard.expense_entries(board_id, date DESC);

CREATE TRIGGER trg_expense_entries_updated_at
  BEFORE UPDATE ON aikiboard.expense_entries
  FOR EACH ROW EXECUTE FUNCTION aikiboard.set_updated_at();
