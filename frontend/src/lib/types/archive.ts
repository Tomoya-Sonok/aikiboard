// アーカイブの API 型(要件 4.4)。backend /api/archives に対応。

export type ArchiveTreeNode = {
  id: string;
  parentId: string | null;
  title: string;
  orderIndex: number;
  createdAt: string;
};

export type ArchiveAttachment = {
  id: string;
  type: "image" | "video" | "aikinote_page";
  url: string | null;
  metadata: Record<string, unknown>;
};

export type ArchiveDetail = {
  id: string;
  parentId: string | null;
  title: string;
  bodyRich: unknown;
  createdAt: string;
  attachments: ArchiveAttachment[];
};

export type ArchiveSearchResult = {
  id: string;
  title: string;
  snippet: string;
};

export type ArchiveAttachmentInput = {
  path: string;
  attachmentType: "image" | "video";
  metadata?: Record<string, unknown>;
};

export type ArchiveUploadUrl = {
  path: string;
  token: string;
  signedUrl: string;
  attachmentType: "image" | "video";
};
