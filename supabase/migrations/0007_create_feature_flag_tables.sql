-- 0007_create_feature_flag_tables.sql
-- 付録 A.6 プラン・課金 + feature_flag(自前実装、外部サービス不使用)。
-- アプリ側で hasFeature(boardId, 'archive') 等で実行時判定する想定。

-- ────────────────────────────────────────────────────────────────
-- aikiboard.plans: プラン定義
-- ────────────────────────────────────────────────────────────────
CREATE TABLE aikiboard.plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE, -- 'free' / 'mini' / 'standard'
  name TEXT NOT NULL,
  -- Stripe Product ID(本番環境固有、Phase 1 で wrangler secret put で運用)
  stripe_product_id TEXT,
  monthly_price_jpy INTEGER, -- 月額料金。Free は NULL
  yearly_price_jpy INTEGER,  -- 年額料金。Free は NULL
  member_limit INTEGER, -- メンバー人数上限。NULL = 無制限
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER trg_plans_updated_at
  BEFORE UPDATE ON aikiboard.plans
  FOR EACH ROW EXECUTE FUNCTION aikiboard.set_updated_at();

-- ────────────────────────────────────────────────────────────────
-- aikiboard.features: 機能定義
-- ────────────────────────────────────────────────────────────────
CREATE TABLE aikiboard.features (
  code TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ────────────────────────────────────────────────────────────────
-- aikiboard.plan_features: プラン × 機能(N:M)
-- ────────────────────────────────────────────────────────────────
CREATE TABLE aikiboard.plan_features (
  plan_id UUID NOT NULL REFERENCES aikiboard.plans(id) ON DELETE CASCADE,
  feature_code TEXT NOT NULL REFERENCES aikiboard.features(code) ON DELETE CASCADE,
  PRIMARY KEY (plan_id, feature_code)
);

CREATE INDEX idx_plan_features_feature_code ON aikiboard.plan_features(feature_code);

-- ────────────────────────────────────────────────────────────────
-- aikiboard.board_subscriptions: ボードごとの契約状態
-- ────────────────────────────────────────────────────────────────
CREATE TYPE aikiboard.subscription_status AS ENUM (
  'trialing', 'active', 'past_due', 'canceled', 'incomplete', 'incomplete_expired', 'unpaid'
);

CREATE TABLE aikiboard.board_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  board_id UUID NOT NULL UNIQUE REFERENCES aikiboard.boards(id) ON DELETE CASCADE,
  plan_id UUID NOT NULL REFERENCES aikiboard.plans(id) ON DELETE RESTRICT,
  -- Stripe 連携用識別子(Phase 1 で本実装)
  stripe_subscription_id TEXT,
  stripe_customer_id TEXT,
  status aikiboard.subscription_status NOT NULL DEFAULT 'trialing',
  trial_ends_at TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  cancel_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_board_subscriptions_status ON aikiboard.board_subscriptions(status);

CREATE TRIGGER trg_board_subscriptions_updated_at
  BEFORE UPDATE ON aikiboard.board_subscriptions
  FOR EACH ROW EXECUTE FUNCTION aikiboard.set_updated_at();

-- ────────────────────────────────────────────────────────────────
-- 初期 seed データ
--   料金は要件定義 6.1 の暫定値。確定後に UPDATE する想定。
-- ────────────────────────────────────────────────────────────────
INSERT INTO aikiboard.plans (code, name, monthly_price_jpy, yearly_price_jpy, member_limit, display_order)
VALUES
  ('free',     'Free',     NULL,  NULL,  20,   1),
  ('mini',     'Mini',     630,   6300,  20,   2),
  ('standard', 'Standard', 980,   9800,  NULL, 3)
ON CONFLICT (code) DO NOTHING;

INSERT INTO aikiboard.features (code, name, description)
VALUES
  ('calendar',      '稽古カレンダー',          '稽古スケジュール管理 + 出欠表明'),
  ('announcements', 'お知らせ配信',            '管理者からメンバーへの一方向告知'),
  ('feed',          '道場内フィード',          '双方向投稿 + スレッド + AikiNote 連携'),
  ('members',       'メンバー管理',            '一覧・参加フロー・退会・削除'),
  ('public_page',   '公開ページ',              '集客用の道場プロフィールページ'),
  ('multi_board',   '複数ボード',              '本部 / 支部などの複数ボード切替'),
  ('archive',       'アーカイブ',              '階層構造で稽古内容・議事録・動画を蓄積(有料)'),
  ('accounting',    '会計の見える化',          '月謝ステータス + 収支可視化(有料)'),
  ('activity_log',  'アクティビティログ',      '操作履歴の閲覧(有料)'),
  ('board_theme',   'ボードテーマカラー',      '10 色プリセットからの選択')
ON CONFLICT (code) DO NOTHING;

-- Free プラン: コア機能のみ
INSERT INTO aikiboard.plan_features (plan_id, feature_code)
SELECT p.id, f.code
FROM aikiboard.plans p
CROSS JOIN aikiboard.features f
WHERE p.code = 'free'
  AND f.code IN ('calendar', 'announcements', 'feed', 'members', 'public_page', 'board_theme')
ON CONFLICT DO NOTHING;

-- Mini プラン: Free + 有料機能(現状すべて。Mini と Standard の差は人数のみ)
INSERT INTO aikiboard.plan_features (plan_id, feature_code)
SELECT p.id, f.code
FROM aikiboard.plans p
CROSS JOIN aikiboard.features f
WHERE p.code = 'mini'
ON CONFLICT DO NOTHING;

-- Standard プラン: 同上
INSERT INTO aikiboard.plan_features (plan_id, feature_code)
SELECT p.id, f.code
FROM aikiboard.plans p
CROSS JOIN aikiboard.features f
WHERE p.code = 'standard'
ON CONFLICT DO NOTHING;
