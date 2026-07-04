// ボード Todo 管理の API 型(owner/admin のみ)。backend /api/board-todos に対応。

export type TodoStatus = "todo" | "in_progress" | "done";

export type TodoAssignee = {
  userId: string;
  username: string;
  profileImageUrl: string | null;
};

export type BoardTodo = {
  id: string;
  title: string;
  status: TodoStatus;
  note: string | null;
  dueDate: string | null;
  createdAt: string;
  assignee: TodoAssignee;
};

// 担当者候補(ボードの owner/admin)。
export type TodoAssigneeOption = {
  userId: string;
  role: string;
  username: string;
  profileImageUrl: string | null;
};
