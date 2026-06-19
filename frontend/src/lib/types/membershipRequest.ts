// 参加申請の API 型(ADR 0002 B-4)。backend /api/membership-requests に対応する。

// GET /discoverable の 1 件(自分の道場に紐づく未所属ボード)。
export type DiscoverableBoard = {
  id: string;
  name: string;
  slug: string;
  isPublic: boolean;
  memberCount: number;
  // 自分の申請状態。null = 未申請、pending = 承認待ち、rejected = 却下済み(再申請可)。
  requestStatus: "pending" | "rejected" | null;
};

// GET /?boardId=(管理者の承認待ち一覧)の 1 件。
export type PendingRequest = {
  id: string;
  userId: string;
  username: string;
  profileImageUrl: string | null;
  message: string | null;
  createdAt: string;
};

// GET /mine の 1 件。
export type MyRequest = {
  id: string;
  boardId: string;
  boardName: string;
  boardSlug: string;
  status: string;
  createdAt: string;
};
