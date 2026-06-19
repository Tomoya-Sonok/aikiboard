// アクティビティログ閲覧 API(要件 4.6)。管理者(owner/admin)のみ + 有料機能(activity_log)。
//
//   認証 authMiddleware → boardAdminMiddleware(管理者判定 + boardId 解決)→
//   requireFeature("activity_log")(プラン判定)。
//
// 書き込みは各機能ルートが lib/activity.ts 経由で行う。本ルートは閲覧専用。

import { Hono } from "hono";
import type { AppBindings, AppVariables } from "../../app.js";
import { logger } from "../../lib/logger.js";
import { authMiddleware } from "../../middleware/auth.js";
import { boardAdminMiddleware } from "../../middleware/boardAccess.js";
import { requireFeature } from "../../middleware/featureGuard.js";

type ActivityEnv = { Bindings: AppBindings; Variables: AppVariables };

const activityLogsRoute = new Hono<ActivityEnv>();

const DEFAULT_LIMIT = 30;
const MAX_LIMIT = 100;

// GET /api/activity-logs?boardId=&limit=&offset= — 操作履歴(管理者 + 有料)。新しい順。
activityLogsRoute.get(
  "/",
  authMiddleware,
  boardAdminMiddleware,
  requireFeature("activity_log"),
  async (c) => {
    const supabase = c.get("supabase");
    if (!supabase) {
      return c.json({ success: false, error: "サーバー設定が不正です" }, 500);
    }
    const boardId = c.get("boardId");

    const limit = Math.min(
      Math.max(Number(c.req.query("limit")) || DEFAULT_LIMIT, 1),
      MAX_LIMIT,
    );
    const offset = Math.max(Number(c.req.query("offset")) || 0, 0);

    const { data, error, count } = await supabase
      .schema("aikiboard")
      .from("activity_logs")
      .select(
        "id, user_id, action, target_type, target_id, metadata, created_at",
        {
          count: "exact",
        },
      )
      .eq("board_id", boardId)
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);
    if (error) {
      logger.error("アクティビティログの取得に失敗", {
        feature: "activity",
        boardId,
      });
      return c.json(
        { success: false, error: "操作履歴の取得に失敗しました" },
        500,
      );
    }

    const items = (data ?? []).map((r) => {
      const meta = (r.metadata ?? {}) as Record<string, unknown>;
      return {
        id: r.id as string,
        action: r.action as string,
        actorName: (meta.actorName as string | undefined) ?? "",
        title: (meta.title as string | undefined) ?? "",
        targetType: (r.target_type as string | null) ?? null,
        targetId: (r.target_id as string | null) ?? null,
        createdAt: r.created_at as string,
      };
    });

    return c.json({
      success: true,
      data: { items, total: count ?? items.length, limit, offset },
    });
  },
);

export default activityLogsRoute;
