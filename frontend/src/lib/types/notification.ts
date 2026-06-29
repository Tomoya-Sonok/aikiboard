// アプリ内通知の API 型(要件 4.9)。backend /api/notifications に対応。

export type NotificationType =
  | "announcement.published"
  | "post.created"
  | "thread.replied"
  | "event.created";

export type NotificationItem = {
  id: string;
  type: string;
  targetType: string | null;
  targetId: string | null;
  actorName: string;
  title: string;
  isRead: boolean;
  createdAt: string;
};

export type NotificationListResult = {
  items: NotificationItem[];
  total: number;
  limit: number;
  offset: number;
};
