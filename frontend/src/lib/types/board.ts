// ボード関連の API レスポンス型(ADR 0002 B-4: DB の型 ≠ API の型)。

export type BoardRole = "owner" | "admin" | "member";

// GET /api/boards(所属ボード一覧)の各要素。
export type BoardSummary = {
  id: string;
  name: string;
  slug: string;
  isPublic: boolean;
  role: BoardRole;
  planCode: string;
  planName: string;
  memberCount: number;
};

// GET /api/boards/:slug(ボード詳細)。viewerRole は非メンバーなら null。
export type BoardDetail = {
  id: string;
  name: string;
  slug: string;
  isPublic: boolean;
  description: string | null;
  themeColorCode: string;
  planCode: string;
  planName: string;
  memberCount: number;
  viewerRole: BoardRole | null;
  isMember: boolean;
};
