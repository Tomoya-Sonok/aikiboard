// メンバー管理の API 型(ADR 0002 B-4: DB の型 ≠ API の型)。
// backend /api/members のレスポンスに対応する。

import type { BoardRole } from "./board";

export type BoardMember = {
  userId: string;
  username: string;
  profileImageUrl: string | null;
  role: BoardRole;
  joinedAt: string;
};
