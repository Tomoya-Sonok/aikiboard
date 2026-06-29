// アクティビティログの API 型(要件 4.6)。backend /api/activity-logs に対応。

export type ActivityItem = {
  id: string;
  action: string;
  actorName: string;
  title: string;
  targetType: string | null;
  targetId: string | null;
  createdAt: string;
};

export type ActivityListResult = {
  items: ActivityItem[];
  total: number;
  limit: number;
  offset: number;
};
