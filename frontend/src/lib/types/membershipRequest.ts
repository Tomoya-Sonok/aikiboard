// 参加申請の API 型(ADR 0002 B-4)。backend /api/membership-requests に対応する。
//
// 申請の「発見・送信」側(discoverable/mine)の型は AikiNote 側で持つ方針(要件 4.5.2)。
// AikiBoard 側は承認側(承認待ち一覧)の型のみを保持する。

// GET /?boardId=(管理者の承認待ち一覧)の 1 件。
export type PendingRequest = {
  id: string;
  userId: string;
  username: string;
  profileImageUrl: string | null;
  message: string | null;
  createdAt: string;
};
