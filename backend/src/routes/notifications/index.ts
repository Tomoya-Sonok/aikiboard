// アプリ内通知 API(要件 4.9)。ボードスコープ。
//
//   - 一覧 / 未読数 / 全既読: boardMemberMiddleware(boardId は query/body)
//   - 1 件既読 / 削除: authMiddleware のみ。recipient_user_id = 自分 でスコープ(行は本人所有)
//
// 通知の生成は各機能のルート(announcements/board-posts/events)が lib/notifications.ts を
// 通じて行う。本ルートは受信者向けの閲覧/既読化に専念する。

import { Hono } from "hono";
import { z } from "zod";
import type { AppBindings, AppVariables } from "../../app.js";
import { logger } from "../../lib/logger.js";
import { authMiddleware } from "../../middleware/auth.js";
import { boardMemberMiddleware } from "../../middleware/boardAccess.js";

type NotificationsEnv = { Bindings: AppBindings; Variables: AppVariables };

const notificationsRoute = new Hono<NotificationsEnv>();

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;

const uuidLike = z
  .string()
  .regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);

// ────────────────────────────────────────────────────────────────
// GET /api/notifications?boardId=&limit=&offset= — 一覧(メンバー)。新しい順。
// ────────────────────────────────────────────────────────────────
notificationsRoute.get(
  "/",
  authMiddleware,
  boardMemberMiddleware,
  async (c) => {
    const supabase = c.get("supabase");
    if (!supabase) {
      return c.json({ success: false, error: "サーバー設定が不正です" }, 500);
    }
    const userId = c.get("userId");
    const boardId = c.get("boardId");
    const aikiboard = supabase.schema("aikiboard");

    const limit = Math.min(
      Math.max(Number(c.req.query("limit")) || DEFAULT_LIMIT, 1),
      MAX_LIMIT,
    );
    const offset = Math.max(Number(c.req.query("offset")) || 0, 0);

    const { data, error, count } = await aikiboard
      .from("notifications")
      .select(
        "id, type, target_type, target_id, metadata, is_read, created_at",
        { count: "exact" },
      )
      .eq("board_id", boardId)
      .eq("recipient_user_id", userId)
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);
    if (error) {
      logger.error("通知の取得に失敗", {
        feature: "notifications",
        boardId,
        userId,
      });
      return c.json({ success: false, error: "通知の取得に失敗しました" }, 500);
    }

    const items = (data ?? []).map((r) => {
      const meta = (r.metadata ?? {}) as Record<string, unknown>;
      return {
        id: r.id as string,
        type: r.type as string,
        targetType: (r.target_type as string | null) ?? null,
        targetId: (r.target_id as string | null) ?? null,
        actorName: (meta.actorName as string | undefined) ?? "",
        title: (meta.title as string | undefined) ?? "",
        isRead: r.is_read as boolean,
        createdAt: r.created_at as string,
      };
    });

    return c.json({
      success: true,
      data: { items, total: count ?? items.length, limit, offset },
    });
  },
);

// ────────────────────────────────────────────────────────────────
// GET /api/notifications/unread-count?boardId= — 未読数(メンバー)。ベルバッジ用。
// ────────────────────────────────────────────────────────────────
notificationsRoute.get(
  "/unread-count",
  authMiddleware,
  boardMemberMiddleware,
  async (c) => {
    const supabase = c.get("supabase");
    if (!supabase) {
      return c.json({ success: false, error: "サーバー設定が不正です" }, 500);
    }
    const userId = c.get("userId");
    const boardId = c.get("boardId");

    const { count, error } = await supabase
      .schema("aikiboard")
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .eq("board_id", boardId)
      .eq("recipient_user_id", userId)
      .eq("is_read", false);
    if (error) {
      logger.error("未読通知数の取得に失敗", {
        feature: "notifications",
        boardId,
        userId,
      });
      return c.json(
        { success: false, error: "未読数の取得に失敗しました" },
        500,
      );
    }

    return c.json({ success: true, data: { count: count ?? 0 } });
  },
);

// ────────────────────────────────────────────────────────────────
// POST /api/notifications/read-all?boardId= — 全既読(メンバー)。
// ────────────────────────────────────────────────────────────────
notificationsRoute.post(
  "/read-all",
  authMiddleware,
  boardMemberMiddleware,
  async (c) => {
    const supabase = c.get("supabase");
    if (!supabase) {
      return c.json({ success: false, error: "サーバー設定が不正です" }, 500);
    }
    const userId = c.get("userId");
    const boardId = c.get("boardId");

    const { error } = await supabase
      .schema("aikiboard")
      .from("notifications")
      .update({ is_read: true })
      .eq("board_id", boardId)
      .eq("recipient_user_id", userId)
      .eq("is_read", false);
    if (error) {
      logger.error("通知の全既読に失敗", {
        feature: "notifications",
        boardId,
        userId,
      });
      return c.json({ success: false, error: "既読化に失敗しました" }, 500);
    }

    return c.json({ success: true, message: "すべて既読にしました" });
  },
);

// ────────────────────────────────────────────────────────────────
// PUT /api/notifications/:id/read — 1 件既読(本人所有のみ)。
//   行は recipient_user_id で本人所有のため、board ミドルウェアは不要。
// ────────────────────────────────────────────────────────────────
notificationsRoute.put("/:id/read", authMiddleware, async (c) => {
  const supabase = c.get("supabase");
  if (!supabase) {
    return c.json({ success: false, error: "サーバー設定が不正です" }, 500);
  }
  const userId = c.get("userId");
  if (!userId) {
    return c.json({ success: false, error: "認証エラー" }, 401);
  }
  const id = c.req.param("id");
  if (!uuidLike.safeParse(id).success) {
    return c.json({ success: false, error: "対象が不正です" }, 400);
  }

  const { error } = await supabase
    .schema("aikiboard")
    .from("notifications")
    .update({ is_read: true })
    .eq("id", id)
    .eq("recipient_user_id", userId);
  if (error) {
    logger.error("通知の既読に失敗", {
      feature: "notifications",
      notificationId: id,
      userId,
    });
    return c.json({ success: false, error: "既読化に失敗しました" }, 500);
  }

  return c.json({ success: true, message: "既読にしました" });
});

// ────────────────────────────────────────────────────────────────
// DELETE /api/notifications/:id — 1 件削除(本人所有のみ)。
// ────────────────────────────────────────────────────────────────
notificationsRoute.delete("/:id", authMiddleware, async (c) => {
  const supabase = c.get("supabase");
  if (!supabase) {
    return c.json({ success: false, error: "サーバー設定が不正です" }, 500);
  }
  const userId = c.get("userId");
  if (!userId) {
    return c.json({ success: false, error: "認証エラー" }, 401);
  }
  const id = c.req.param("id");
  if (!uuidLike.safeParse(id).success) {
    return c.json({ success: false, error: "対象が不正です" }, 400);
  }

  const { error } = await supabase
    .schema("aikiboard")
    .from("notifications")
    .delete()
    .eq("id", id)
    .eq("recipient_user_id", userId);
  if (error) {
    logger.error("通知の削除に失敗", {
      feature: "notifications",
      notificationId: id,
      userId,
    });
    return c.json({ success: false, error: "削除に失敗しました" }, 500);
  }

  return c.json({ success: true, message: "削除しました" });
});

export default notificationsRoute;
