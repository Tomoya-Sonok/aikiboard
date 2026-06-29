// メンバー管理 API(要件 4.5.1 / 4.5.3)。
//
//   - GET  /api/members?boardId=          : メンバー一覧(メンバー以上)
//   - DELETE /api/members/:userId?boardId= : 管理者がメンバーを削除(owner/admin)
//   - POST /api/members/leave              : 自主退会(メンバー本人)
//
// 認可は boardAccess ミドルウェア(backend は service_role で RLS バイパスのため唯一の砦)。
// 削除/退会では board_members を消すだけでなく、その人のこのボードでの出欠
// (event_rsvps)と既読(announcement_reads)も掃除する — これらは board_members に
// CASCADE しない独立行のため、残すと出欠名簿などにゴミが残る(.agent の注意点)。

import type { SupabaseClient } from "@supabase/supabase-js";
import { type Context, Hono } from "hono";
import { z } from "zod";
import type { AppBindings, AppVariables, BoardRole } from "../../app.js";
import { logActivity } from "../../lib/activity.js";
import { logger } from "../../lib/logger.js";
import { authMiddleware } from "../../middleware/auth.js";
import {
  boardAdminMiddleware,
  boardMemberMiddleware,
} from "../../middleware/boardAccess.js";

type MembersEnv = { Bindings: AppBindings; Variables: AppVariables };

const membersRoute = new Hono<MembersEnv>();

const leaveSchema = z.object({
  boardId: z
    .string()
    .regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i),
});

const parseJson = async (c: Context<MembersEnv>): Promise<unknown> => {
  try {
    return await c.req.json();
  } catch {
    return undefined;
  }
};

// 退会/削除されたユーザーの、当該ボードでの出欠・既読を掃除する。
const cleanupMemberData = async (
  supabase: SupabaseClient,
  boardId: string,
  userId: string,
): Promise<void> => {
  const aikiboard = supabase.schema("aikiboard");

  const [eventsRes, annsRes] = await Promise.all([
    aikiboard.from("events").select("id").eq("board_id", boardId),
    aikiboard.from("announcements").select("id").eq("board_id", boardId),
  ]);

  const eventIds = (eventsRes.data ?? []).map((e) => e.id as string);
  if (eventIds.length > 0) {
    await aikiboard
      .from("event_rsvps")
      .delete()
      .eq("user_id", userId)
      .in("event_id", eventIds);
  }
  const annIds = (annsRes.data ?? []).map((a) => a.id as string);
  if (annIds.length > 0) {
    await aikiboard
      .from("announcement_reads")
      .delete()
      .eq("user_id", userId)
      .in("announcement_id", annIds);
  }
};

// ────────────────────────────────────────────────────────────────
// GET /api/members?boardId= — メンバー一覧(メンバー以上)
// ────────────────────────────────────────────────────────────────
membersRoute.get("/", authMiddleware, boardMemberMiddleware, async (c) => {
  const supabase = c.get("supabase");
  if (!supabase) {
    return c.json({ success: false, error: "サーバー設定が不正です" }, 500);
  }
  const boardId = c.get("boardId");
  const aikiboard = supabase.schema("aikiboard");

  const failWith = (logMessage: string) => {
    logger.error(logMessage, { feature: "members", boardId });
    return c.json(
      { success: false, error: "メンバーの取得に失敗しました" },
      500,
    );
  };

  const { data: members, error } = await aikiboard
    .from("board_members")
    .select("user_id, role, joined_at")
    .eq("board_id", boardId);
  if (error) {
    return failWith("board_members の取得に失敗");
  }
  const rows = members ?? [];
  const ids = rows.map((m) => m.user_id as string);

  const userById = new Map<
    string,
    { username: string; profileImageUrl: string | null }
  >();
  if (ids.length > 0) {
    const { data: users, error: userError } = await supabase
      .from("User")
      .select("id, username, profile_image_url")
      .in("id", ids);
    if (userError) {
      return failWith("ユーザー情報の取得に失敗");
    }
    for (const u of users ?? []) {
      userById.set(u.id, {
        username: u.username ?? "",
        profileImageUrl: u.profile_image_url ?? null,
      });
    }
  }

  // 表示順: owner → admin → member、同ロール内は参加日昇順。
  const roleOrder: Record<BoardRole, number> = {
    owner: 0,
    admin: 1,
    member: 2,
  };
  const data = rows
    .map((m) => ({
      userId: m.user_id as string,
      username: userById.get(m.user_id as string)?.username ?? "",
      profileImageUrl:
        userById.get(m.user_id as string)?.profileImageUrl ?? null,
      role: m.role as BoardRole,
      joinedAt: m.joined_at as string,
    }))
    .sort((a, b) => {
      const r = roleOrder[a.role] - roleOrder[b.role];
      return r !== 0 ? r : Date.parse(a.joinedAt) - Date.parse(b.joinedAt);
    });

  return c.json({ success: true, data });
});

// ────────────────────────────────────────────────────────────────
// POST /api/members/leave — 自主退会(メンバー本人)。owner は退会不可。
// ────────────────────────────────────────────────────────────────
membersRoute.post(
  "/leave",
  authMiddleware,
  boardMemberMiddleware,
  async (c) => {
    const supabase = c.get("supabase");
    if (!supabase) {
      return c.json({ success: false, error: "サーバー設定が不正です" }, 500);
    }
    const userId = c.get("userId");
    const boardId = c.get("boardId");
    const boardRole = c.get("boardRole");

    const parsed = leaveSchema.safeParse(await parseJson(c));
    if (!parsed.success) {
      return c.json({ success: false, error: "入力内容に誤りがあります" }, 400);
    }

    if (boardRole === "owner") {
      return c.json(
        {
          success: false,
          error: "オーナーは退会できません。先に権限を引き継いでください",
        },
        400,
      );
    }

    const { error } = await supabase
      .schema("aikiboard")
      .from("board_members")
      .delete()
      .eq("board_id", boardId)
      .eq("user_id", userId);
    if (error) {
      logger.error("退会に失敗", { feature: "members", boardId, userId });
      return c.json({ success: false, error: "退会に失敗しました" }, 500);
    }

    await cleanupMemberData(supabase, boardId ?? "", userId ?? "");
    logger.info("メンバーが退会した", { feature: "members", boardId, userId });
    if (boardId) {
      await logActivity(supabase, {
        boardId,
        userId: userId ?? null,
        action: "member.left",
        targetType: "member",
        targetId: userId ?? null,
      });
    }
    return c.json({ success: true, message: "退会しました" });
  },
);

// ────────────────────────────────────────────────────────────────
// DELETE /api/members/:userId?boardId= — 管理者がメンバーを削除(owner/admin)。
//   owner は削除不可。自分自身はこのルートでは削除させない(退会を使う)。
// ────────────────────────────────────────────────────────────────
membersRoute.delete(
  "/:userId",
  authMiddleware,
  boardAdminMiddleware,
  async (c) => {
    const supabase = c.get("supabase");
    if (!supabase) {
      return c.json({ success: false, error: "サーバー設定が不正です" }, 500);
    }
    const actorId = c.get("userId");
    const boardId = c.get("boardId");
    const targetId = c.req.param("userId");
    const aikiboard = supabase.schema("aikiboard");

    if (targetId === actorId) {
      return c.json(
        { success: false, error: "自分自身は退会から操作してください" },
        400,
      );
    }

    const { data: target, error: targetError } = await aikiboard
      .from("board_members")
      .select("role")
      .eq("board_id", boardId)
      .eq("user_id", targetId)
      .maybeSingle();
    if (targetError) {
      logger.error("対象メンバーの確認に失敗", { feature: "members", boardId });
      return c.json({ success: false, error: "削除に失敗しました" }, 500);
    }
    if (!target) {
      return c.json({ success: false, error: "対象が見つかりません" }, 404);
    }
    if (target.role === "owner") {
      return c.json({ success: false, error: "オーナーは削除できません" }, 400);
    }

    const { error } = await aikiboard
      .from("board_members")
      .delete()
      .eq("board_id", boardId)
      .eq("user_id", targetId);
    if (error) {
      logger.error("メンバー削除に失敗", {
        feature: "members",
        boardId,
        targetId,
      });
      return c.json({ success: false, error: "削除に失敗しました" }, 500);
    }

    await cleanupMemberData(supabase, boardId ?? "", targetId);
    logger.info("メンバーを削除した", {
      feature: "members",
      boardId,
      targetId,
    });
    if (boardId) {
      await logActivity(supabase, {
        boardId,
        userId: actorId ?? null,
        action: "member.removed",
        targetType: "member",
        targetId,
      });
    }
    return c.json({ success: true, message: "メンバーを削除しました" });
  },
);

export default membersRoute;
