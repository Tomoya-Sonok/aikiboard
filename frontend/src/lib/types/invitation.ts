// 招待リンクの API 型(ADR 0002 B-4)。backend /api/invitations に対応する。

export type Invitation = {
  id: string;
  token: string;
  expiresAt: string;
  label: string | null;
  createdAt: string;
};

// GET /api/invitations/token/:token のプレビュー。
export type InvitePreview = {
  boardName: string;
  boardSlug: string;
  memberCount: number;
  alreadyMember: boolean;
};

// POST /api/invitations/token/:token/join の戻り。
export type InviteJoinResult = {
  boardSlug: string;
  alreadyMember: boolean;
};
