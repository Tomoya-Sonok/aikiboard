// 招待リンク API(要件 4.5.2)。共有リンク型(マルチユース): 1 本の token を全員で共有し、
// 有効期限内 & 未失効なら何人でも参加できる(migration 012)。
//
//   - POST   /api/invitations               : 招待を発行(owner/admin)
//   - GET    /api/invitations?boardId=       : 有効な招待一覧(owner/admin)
//   - POST   /api/invitations/:id/revoke     : 招待を失効(owner/admin)
//   - GET    /api/invitations/token/:token   : 招待のプレビュー(認証ユーザー、非メンバー可)
//   - POST   /api/invitations/token/:token/join : 招待で参加(認証ユーザー)
//
// 認可: 発行・一覧・失効は boardAccess の admin ガード。token 経路は「まだメンバーでない」
// ユーザーが使うため board ガードを通さず、authMiddleware + token 検証で守る
// (backend は service_role で RLS バイパス)。

import { type Context, Hono } from "hono";
import { z } from "zod";
import type { AppBindings, AppVariables } from "../../app.js";
import { logger } from "../../lib/logger.js";
import { authMiddleware } from "../../middleware/auth.js";
import {
  boardAdminMiddleware,
  invitationAdminMiddleware,
} from "../../middleware/boardAccess.js";

type InvitationsEnv = { Bindings: AppBindings; Variables: AppVariables };

const invitationsRoute = new Hono<InvitationsEnv>();

const uuidLike = z
  .string()
  .regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);

const DEFAULT_EXPIRES_DAYS = 30;
const MAX_EXPIRES_DAYS = 365;

const createSchema = z.object({
  boardId: uuidLike,
  expiresInDays: z.number().int().min(1).max(MAX_EXPIRES_DAYS).optional(),
  label: z.string().max(100).optional(),
});

const parseJson = async (c: Context<InvitationsEnv>): Promise<unknown> => {
  try {
    return await c.req.json();
  } catch {
    return undefined;
  }
};

// 推測困難な招待トークン。crypto.randomUUID は Workers / Node 双方で利用可。
const generateToken = (): string =>
  `${crypto.randomUUID()}${crypto.randomUUID()}`.replace(/-/g, "");

// ────────────────────────────────────────────────────────────────
// POST /api/invitations — 招待を発行(owner/admin)
// ────────────────────────────────────────────────────────────────
invitationsRoute.post("/", authMiddleware, boardAdminMiddleware, async (c) => {
  const supabase = c.get("supabase");
  if (!supabase) {
    return c.json({ success: false, error: "サーバー設定が不正です" }, 500);
  }
  const userId = c.get("userId");
  const boardId = c.get("boardId");

  const parsed = createSchema.safeParse(await parseJson(c));
  if (!parsed.success) {
    return c.json({ success: false, error: "入力内容に誤りがあります" }, 400);
  }
  const days = parsed.data.expiresInDays ?? DEFAULT_EXPIRES_DAYS;
  const expiresAt = new Date(
    Date.now() + days * 24 * 60 * 60 * 1000,
  ).toISOString();

  const { data, error } = await supabase
    .schema("aikiboard")
    .from("invitations")
    .insert({
      board_id: boardId,
      token: generateToken(),
      expires_at: expiresAt,
      label: parsed.data.label ?? null,
      created_by_user_id: userId,
    })
    .select("id, token, expires_at, label, created_at")
    .single();
  if (error || !data) {
    logger.error("招待の発行に失敗", { feature: "invitations", boardId });
    return c.json(
      { success: false, error: "招待リンクの発行に失敗しました" },
      500,
    );
  }

  logger.info("招待を発行した", {
    feature: "invitations",
    boardId,
    invitationId: data.id,
  });
  return c.json({
    success: true,
    data: {
      id: data.id,
      token: data.token,
      expiresAt: data.expires_at,
      label: data.label ?? null,
      createdAt: data.created_at,
    },
    message: "招待リンクを作成しました",
  });
});

// ────────────────────────────────────────────────────────────────
// GET /api/invitations?boardId= — 有効な招待一覧(owner/admin)
//   失効済み・期限切れは除外して返す。
// ────────────────────────────────────────────────────────────────
invitationsRoute.get("/", authMiddleware, boardAdminMiddleware, async (c) => {
  const supabase = c.get("supabase");
  if (!supabase) {
    return c.json({ success: false, error: "サーバー設定が不正です" }, 500);
  }
  const boardId = c.get("boardId");

  const { data, error } = await supabase
    .schema("aikiboard")
    .from("invitations")
    .select("id, token, expires_at, label, created_at")
    .eq("board_id", boardId)
    .is("revoked_at", null)
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false });
  if (error) {
    logger.error("招待一覧の取得に失敗", { feature: "invitations", boardId });
    return c.json(
      { success: false, error: "招待リンクの取得に失敗しました" },
      500,
    );
  }

  const items = (data ?? []).map((r) => ({
    id: r.id as string,
    token: r.token as string,
    expiresAt: r.expires_at as string,
    label: (r.label as string | null) ?? null,
    createdAt: r.created_at as string,
  }));
  return c.json({ success: true, data: items });
});

// ────────────────────────────────────────────────────────────────
// POST /api/invitations/:id/revoke — 招待を失効(owner/admin)
// ────────────────────────────────────────────────────────────────
invitationsRoute.post(
  "/:id/revoke",
  authMiddleware,
  invitationAdminMiddleware,
  async (c) => {
    const supabase = c.get("supabase");
    if (!supabase) {
      return c.json({ success: false, error: "サーバー設定が不正です" }, 500);
    }
    const id = c.req.param("id");

    const { error } = await supabase
      .schema("aikiboard")
      .from("invitations")
      .update({ revoked_at: new Date().toISOString() })
      .eq("id", id);
    if (error) {
      logger.error("招待の失効に失敗", {
        feature: "invitations",
        invitationId: id,
      });
      return c.json({ success: false, error: "失効に失敗しました" }, 500);
    }

    return c.json({ success: true, message: "招待リンクを失効しました" });
  },
);

// token から有効な招待 + ボードを引く(プレビュー・参加で共用)。
const resolveInvitation = async (
  supabase: NonNullable<AppVariables["supabase"]>,
  token: string,
): Promise<
  | { ok: true; boardId: string; board: { name: string; slug: string } }
  | { ok: false; reason: "notfound" | "error" }
> => {
  const aikiboard = supabase.schema("aikiboard");
  const { data: inv, error } = await aikiboard
    .from("invitations")
    .select("board_id, expires_at, revoked_at")
    .eq("token", token)
    .maybeSingle();
  if (error) {
    return { ok: false, reason: "error" };
  }
  if (
    !inv ||
    inv.revoked_at != null ||
    Date.parse(inv.expires_at) <= Date.now()
  ) {
    return { ok: false, reason: "notfound" };
  }
  const { data: board, error: boardError } = await aikiboard
    .from("boards")
    .select("name, slug")
    .eq("id", inv.board_id)
    .maybeSingle();
  if (boardError || !board) {
    return { ok: false, reason: "error" };
  }
  return {
    ok: true,
    boardId: inv.board_id as string,
    board: { name: board.name as string, slug: board.slug as string },
  };
};

// ────────────────────────────────────────────────────────────────
// GET /api/invitations/token/:token — 招待のプレビュー(認証ユーザー、非メンバー可)
// ────────────────────────────────────────────────────────────────
invitationsRoute.get("/token/:token", authMiddleware, async (c) => {
  const supabase = c.get("supabase");
  if (!supabase) {
    return c.json({ success: false, error: "サーバー設定が不正です" }, 500);
  }
  const userId = c.get("userId");
  const token = c.req.param("token");

  const resolved = await resolveInvitation(supabase, token);
  if (!resolved.ok) {
    if (resolved.reason === "error") {
      return c.json({ success: false, error: "招待の確認に失敗しました" }, 500);
    }
    return c.json(
      { success: false, error: "招待リンクが無効か期限切れです" },
      404,
    );
  }

  const aikiboard = supabase.schema("aikiboard");
  const [membershipRes, membersRes] = await Promise.all([
    aikiboard
      .from("board_members")
      .select("role")
      .eq("board_id", resolved.boardId)
      .eq("user_id", userId)
      .maybeSingle(),
    aikiboard
      .from("board_members")
      .select("user_id")
      .eq("board_id", resolved.boardId),
  ]);

  return c.json({
    success: true,
    data: {
      boardName: resolved.board.name,
      boardSlug: resolved.board.slug,
      memberCount: membersRes.data?.length ?? 0,
      alreadyMember: Boolean(membershipRes.data),
    },
  });
});

// ────────────────────────────────────────────────────────────────
// POST /api/invitations/token/:token/join — 招待で参加(認証ユーザー)
// ────────────────────────────────────────────────────────────────
invitationsRoute.post("/token/:token/join", authMiddleware, async (c) => {
  const supabase = c.get("supabase");
  if (!supabase) {
    return c.json({ success: false, error: "サーバー設定が不正です" }, 500);
  }
  const userId = c.get("userId");
  const token = c.req.param("token");
  const aikiboard = supabase.schema("aikiboard");

  const resolved = await resolveInvitation(supabase, token);
  if (!resolved.ok) {
    if (resolved.reason === "error") {
      return c.json({ success: false, error: "参加に失敗しました" }, 500);
    }
    return c.json(
      { success: false, error: "招待リンクが無効か期限切れです" },
      404,
    );
  }

  // 既にメンバーなら冪等にボードへ通す。
  const { data: existing } = await aikiboard
    .from("board_members")
    .select("role")
    .eq("board_id", resolved.boardId)
    .eq("user_id", userId)
    .maybeSingle();
  if (existing) {
    return c.json({
      success: true,
      data: { boardSlug: resolved.board.slug, alreadyMember: true },
      message: "すでに参加しています",
    });
  }

  const { error } = await aikiboard
    .from("board_members")
    .insert({ board_id: resolved.boardId, user_id: userId, role: "member" });
  if (error) {
    logger.error("招待での参加に失敗", {
      feature: "invitations",
      boardId: resolved.boardId,
      userId,
    });
    return c.json({ success: false, error: "参加に失敗しました" }, 500);
  }

  logger.info("招待で参加した", {
    feature: "invitations",
    boardId: resolved.boardId,
    userId,
  });
  return c.json({
    success: true,
    data: { boardSlug: resolved.board.slug, alreadyMember: false },
    message: "参加しました",
  });
});

export default invitationsRoute;
