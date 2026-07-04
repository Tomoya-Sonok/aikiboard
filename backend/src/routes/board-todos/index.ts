// ボード Todo 管理 API(運営タスク)。**owner/admin のみ**(member は参照不可)。
//
//   一覧 / 担当者候補 / 作成 / 編集 / 削除: すべて boardTodoAdminMiddleware(owner/admin)。
//
// 認可は boardAccess(board_todos 版)が砦(backend は service_role で RLS バイパス)。
// 担当者はボードの owner/admin に限定(member はアサイン不可)。

import { type Context, Hono } from "hono";
import { z } from "zod";
import type { AppBindings, AppVariables } from "../../app.js";
import { logger } from "../../lib/logger.js";
import { authMiddleware } from "../../middleware/auth.js";
import { boardTodoAdminMiddleware } from "../../middleware/boardAccess.js";

type TodosEnv = { Bindings: AppBindings; Variables: AppVariables };

const boardTodosRoute = new Hono<TodosEnv>();

const uuidLike = z
  .string()
  .regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);

const TITLE_MAX = 20;
const NOTE_MAX = 300;
const statusEnum = z.enum(["todo", "in_progress", "done"]);
const dateStr = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .nullable()
  .optional();

const createSchema = z.object({
  boardId: uuidLike,
  title: z.string().trim().min(1).max(TITLE_MAX),
  assigneeUserId: uuidLike,
  note: z.string().trim().max(NOTE_MAX).optional(),
  status: statusEnum.optional(),
  dueDate: dateStr,
});

const updateSchema = z.object({
  title: z.string().trim().min(1).max(TITLE_MAX).optional(),
  assigneeUserId: uuidLike.optional(),
  note: z.string().trim().max(NOTE_MAX).nullable().optional(),
  status: statusEnum.optional(),
  dueDate: dateStr,
});

const parseJson = async (c: Context<TodosEnv>): Promise<unknown> => {
  try {
    return await c.req.json();
  } catch {
    return undefined;
  }
};

type UserInfo = { username: string; profileImageUrl: string | null };
const resolveUsers = async (
  supabase: NonNullable<AppVariables["supabase"]>,
  ids: string[],
): Promise<Map<string, UserInfo>> => {
  const byId = new Map<string, UserInfo>();
  const unique = [...new Set(ids)];
  if (unique.length === 0) return byId;
  const { data } = await supabase
    .from("User")
    .select("id, username, profile_image_url")
    .in("id", unique);
  for (const u of data ?? []) {
    byId.set(u.id, {
      username: u.username ?? "",
      profileImageUrl: u.profile_image_url ?? null,
    });
  }
  return byId;
};

// 担当者は owner/admin に限定する。指定 user がボードの管理者かを検証。
const isBoardAdminUser = async (
  supabase: NonNullable<AppVariables["supabase"]>,
  boardId: string,
  userId: string,
): Promise<boolean> => {
  const { data } = await supabase
    .schema("aikiboard")
    .from("board_members")
    .select("role")
    .eq("board_id", boardId)
    .eq("user_id", userId)
    .maybeSingle();
  const role = data?.role as string | undefined;
  return role === "owner" || role === "admin";
};

// ────────────────────────────────────────────────────────────────
// GET /api/board-todos?boardId= — 一覧(owner/admin)
// ────────────────────────────────────────────────────────────────
boardTodosRoute.get(
  "/",
  authMiddleware,
  boardTodoAdminMiddleware,
  async (c) => {
    const supabase = c.get("supabase");
    if (!supabase) {
      return c.json({ success: false, error: "サーバー設定が不正です" }, 500);
    }
    const boardId = c.get("boardId");

    const { data, error } = await supabase
      .schema("aikiboard")
      .from("board_todos")
      .select("id, title, assignee_user_id, note, status, due_date, created_at")
      .eq("board_id", boardId)
      .order("order_index", { ascending: true })
      .order("created_at", { ascending: false });
    if (error) {
      logger.error("Todo の取得に失敗", { feature: "board-todos", boardId });
      return c.json(
        { success: false, error: "Todo の取得に失敗しました" },
        500,
      );
    }
    const rows = data ?? [];
    const users = await resolveUsers(
      supabase,
      rows.map((r) => r.assignee_user_id as string),
    );
    const items = rows.map((r) => ({
      id: r.id as string,
      title: r.title as string,
      status: r.status as string,
      note: (r.note as string | null) ?? null,
      dueDate: (r.due_date as string | null) ?? null,
      createdAt: r.created_at as string,
      assignee: {
        userId: r.assignee_user_id as string,
        username: users.get(r.assignee_user_id as string)?.username ?? "",
        profileImageUrl:
          users.get(r.assignee_user_id as string)?.profileImageUrl ?? null,
      },
    }));
    return c.json({ success: true, data: items });
  },
);

// ────────────────────────────────────────────────────────────────
// GET /api/board-todos/assignees?boardId= — 担当者候補(owner/admin)
//   静的セグメントなので /:id より前に定義(:id GET は無いが順序を明示)。
// ────────────────────────────────────────────────────────────────
boardTodosRoute.get(
  "/assignees",
  authMiddleware,
  boardTodoAdminMiddleware,
  async (c) => {
    const supabase = c.get("supabase");
    if (!supabase) {
      return c.json({ success: false, error: "サーバー設定が不正です" }, 500);
    }
    const boardId = c.get("boardId");

    const { data, error } = await supabase
      .schema("aikiboard")
      .from("board_members")
      .select("user_id, role")
      .eq("board_id", boardId)
      .in("role", ["owner", "admin"]);
    if (error) {
      return c.json(
        { success: false, error: "担当者候補の取得に失敗しました" },
        500,
      );
    }
    const rows = data ?? [];
    const users = await resolveUsers(
      supabase,
      rows.map((r) => r.user_id as string),
    );
    const items = rows
      .map((r) => ({
        userId: r.user_id as string,
        role: r.role as string,
        username: users.get(r.user_id as string)?.username ?? "",
        profileImageUrl:
          users.get(r.user_id as string)?.profileImageUrl ?? null,
      }))
      .sort((a, b) => a.username.localeCompare(b.username, "ja"));
    return c.json({ success: true, data: items });
  },
);

// ────────────────────────────────────────────────────────────────
// POST /api/board-todos — 作成(owner/admin)
// ────────────────────────────────────────────────────────────────
boardTodosRoute.post(
  "/",
  authMiddleware,
  boardTodoAdminMiddleware,
  async (c) => {
    const supabase = c.get("supabase");
    if (!supabase) {
      return c.json({ success: false, error: "サーバー設定が不正です" }, 500);
    }
    const userId = c.get("userId") as string;
    const boardId = c.get("boardId") as string;

    const parsed = createSchema.safeParse(await parseJson(c));
    if (!parsed.success) {
      return c.json({ success: false, error: "入力内容に誤りがあります" }, 400);
    }
    if (
      !(await isBoardAdminUser(supabase, boardId, parsed.data.assigneeUserId))
    ) {
      return c.json(
        { success: false, error: "担当者は管理者から選択してください" },
        400,
      );
    }

    const { data, error } = await supabase
      .schema("aikiboard")
      .from("board_todos")
      .insert({
        board_id: boardId,
        title: parsed.data.title,
        assignee_user_id: parsed.data.assigneeUserId,
        note: parsed.data.note?.trim() ? parsed.data.note.trim() : null,
        status: parsed.data.status ?? "todo",
        due_date: parsed.data.dueDate ?? null,
        created_by_user_id: userId,
      })
      .select("id")
      .single();
    if (error || !data) {
      logger.error("Todo の作成に失敗", { feature: "board-todos", boardId });
      return c.json(
        { success: false, error: "Todo の作成に失敗しました" },
        500,
      );
    }
    logger.info("Todo を作成した", {
      feature: "board-todos",
      boardId,
      todoId: data.id,
    });
    return c.json({
      success: true,
      data: { id: data.id },
      message: "Todo を作成しました",
    });
  },
);

// ────────────────────────────────────────────────────────────────
// PATCH /api/board-todos/:id — 編集(owner/admin)
// ────────────────────────────────────────────────────────────────
boardTodosRoute.patch(
  "/:id",
  authMiddleware,
  boardTodoAdminMiddleware,
  async (c) => {
    const supabase = c.get("supabase");
    if (!supabase) {
      return c.json({ success: false, error: "サーバー設定が不正です" }, 500);
    }
    const id = c.req.param("id");
    const boardId = c.get("boardId") as string;

    const parsed = updateSchema.safeParse(await parseJson(c));
    if (!parsed.success) {
      return c.json({ success: false, error: "入力内容に誤りがあります" }, 400);
    }
    const p = parsed.data;
    if (
      p.assigneeUserId !== undefined &&
      !(await isBoardAdminUser(supabase, boardId, p.assigneeUserId))
    ) {
      return c.json(
        { success: false, error: "担当者は管理者から選択してください" },
        400,
      );
    }

    const update: Record<string, unknown> = {};
    if (p.title !== undefined) update.title = p.title;
    if (p.assigneeUserId !== undefined)
      update.assignee_user_id = p.assigneeUserId;
    if (p.note !== undefined)
      update.note = p.note?.trim() ? p.note.trim() : null;
    if (p.status !== undefined) update.status = p.status;
    if (p.dueDate !== undefined) update.due_date = p.dueDate;
    if (Object.keys(update).length === 0) {
      return c.json({ success: false, error: "変更内容がありません" }, 400);
    }

    const { error } = await supabase
      .schema("aikiboard")
      .from("board_todos")
      .update(update)
      .eq("id", id);
    if (error) {
      logger.error("Todo の更新に失敗", { feature: "board-todos", todoId: id });
      return c.json(
        { success: false, error: "Todo の更新に失敗しました" },
        500,
      );
    }
    return c.json({ success: true, message: "Todo を更新しました" });
  },
);

// ────────────────────────────────────────────────────────────────
// DELETE /api/board-todos/:id — 削除(owner/admin)
// ────────────────────────────────────────────────────────────────
boardTodosRoute.delete(
  "/:id",
  authMiddleware,
  boardTodoAdminMiddleware,
  async (c) => {
    const supabase = c.get("supabase");
    if (!supabase) {
      return c.json({ success: false, error: "サーバー設定が不正です" }, 500);
    }
    const id = c.req.param("id");

    const { error } = await supabase
      .schema("aikiboard")
      .from("board_todos")
      .delete()
      .eq("id", id);
    if (error) {
      logger.error("Todo の削除に失敗", { feature: "board-todos", todoId: id });
      return c.json(
        { success: false, error: "Todo の削除に失敗しました" },
        500,
      );
    }
    return c.json({ success: true, message: "Todo を削除しました" });
  },
);

export default boardTodosRoute;
