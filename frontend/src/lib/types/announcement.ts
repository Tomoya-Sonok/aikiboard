// お知らせ配信の API 型(ADR 0002 B-4: DB の型 ≠ API の型)。
// backend /api/announcements のレスポンス・入力に対応する。

// body_rich は ProseMirror / Tiptap の doc JSON。閲覧は RichTextView、編集は Tiptap。
// 構造の検証は backend(lib/richtext.ts)が担うため、frontend では unknown 扱いにして
// レンダラ側でノードを安全に解釈する。
export type RichDoc = unknown;

// GET /api/announcements の一覧 1 件。
export type AnnouncementSummary = {
  id: string;
  title: string;
  excerpt: string;
  notifyEmail: boolean;
  authorName: string;
  publishedAt: string | null;
  createdAt: string;
  isDraft: boolean;
  isRead: boolean;
};

// GET /api/announcements の戻り(ページネーション付き)。
export type AnnouncementListResult = {
  items: AnnouncementSummary[];
  total: number;
  limit: number;
  offset: number;
};

// GET /api/announcements/:id(詳細)。bodyRich 全文を含む。
export type AnnouncementDetail = {
  id: string;
  title: string;
  bodyRich: RichDoc;
  notifyEmail: boolean;
  authorName: string;
  publishedAt: string | null;
  createdAt: string;
  isDraft: boolean;
  isRead: boolean;
};
