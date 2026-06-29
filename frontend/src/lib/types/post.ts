// 道場内フィードの API 型(ADR 0002 B-4: DB の型 ≠ API の型)。
// backend /api/board-posts のレスポンス・入力に対応する。

export type PostAttachmentType = "image" | "video";

// 投稿の添付。url は短命の署名付き DL URL(backend が都度発行。期限切れなら null)。
export type PostAttachment = {
  id: string;
  type: PostAttachmentType;
  url: string | null;
  metadata: Record<string, unknown>;
};

export type PostAuthor = {
  userId: string;
  username: string;
  profileImageUrl: string | null;
};

// GET /api/board-posts の一覧 1 件 / GET /api/board-posts/:id の詳細。
export type FeedPost = {
  id: string;
  body: string;
  author: PostAuthor;
  attachments: PostAttachment[];
  replyCount: number;
  crossPostToAikinote: boolean;
  syncedFromPostId: string | null;
  createdAt: string;
  canDelete: boolean;
};

export type FeedListResult = {
  items: FeedPost[];
  total: number;
  limit: number;
  offset: number;
};

// GET /api/board-posts/:id/threads の返信 1 件。
export type ThreadReply = {
  id: string;
  body: string;
  author: PostAuthor;
  createdAt: string;
  canDelete: boolean;
};

// POST /api/board-posts/upload-url の戻り。
export type UploadUrlResult = {
  path: string;
  token: string;
  signedUrl: string;
  attachmentType: PostAttachmentType;
};

// POST /api/board-posts の attachments 入力 1 件。
export type PostAttachmentInput = {
  path: string;
  attachmentType: PostAttachmentType;
  metadata?: Record<string, unknown>;
};
