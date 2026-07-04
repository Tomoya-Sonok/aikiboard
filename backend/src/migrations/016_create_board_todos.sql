-- 0016_create_board_todos.sql
-- ボードごとの Todo 管理(運営タスク)。owner/admin のみ閲覧・編集でき、member は参照不可。
--
-- プロパティ: タイトル(必須・20字以内)/ 担当者(必須・ボードの owner/admin)/ 備考(任意・300字以内)
--   / ステータス(未着手・進行中・完了)/ 期限(任意)。

CREATE TYPE aikiboard.todo_status AS ENUM ('todo', 'in_progress', 'done');

CREATE TABLE aikiboard.board_todos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  board_id UUID NOT NULL REFERENCES aikiboard.boards(id) ON DELETE CASCADE,
  title TEXT NOT NULL CHECK (char_length(title) BETWEEN 1 AND 20),
  -- 担当者(→ public."User"(id)、Phase 1 で FK)。アプリ層で owner/admin 限定を検証する。
  assignee_user_id UUID NOT NULL,
  note TEXT CHECK (note IS NULL OR char_length(note) <= 300),
  status aikiboard.todo_status NOT NULL DEFAULT 'todo',
  due_date DATE,
  -- 同一ステータス内の並び順(将来の手動並べ替え用)。
  order_index INTEGER NOT NULL DEFAULT 0,
  created_by_user_id UUID NOT NULL, -- → public."User"(id)、Phase 1 で FK
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_board_todos_board_status
  ON aikiboard.board_todos(board_id, status, order_index);
CREATE INDEX idx_board_todos_assignee ON aikiboard.board_todos(assignee_user_id);

CREATE TRIGGER trg_board_todos_updated_at
  BEFORE UPDATE ON aikiboard.board_todos
  FOR EACH ROW EXECUTE FUNCTION aikiboard.set_updated_at();

-- ────────────────────────────────────────────────────────────────
-- RLS: owner/admin のみ全操作可(member は SELECT も不可)。
--   backend は service_role でバイパスするため、認可の砦はミドルウェア。RLS は anon 直アクセス防御。
-- ────────────────────────────────────────────────────────────────
ALTER TABLE aikiboard.board_todos ENABLE ROW LEVEL SECURITY;

CREATE POLICY board_todos_admin ON aikiboard.board_todos
  FOR ALL TO authenticated
  USING (aikiboard.is_admin_or_owner_of_board(board_id, auth.uid()))
  WITH CHECK (aikiboard.is_admin_or_owner_of_board(board_id, auth.uid()));
