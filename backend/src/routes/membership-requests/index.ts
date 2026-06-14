// AikiNote 道場からの参加申請 API(要件 4.5.2)。
//
// AikiNote ユーザーは public."User".dojo_style_id で 1 つの道場に紐づく。その道場に
// 紐づくボード(board_dojo_masters)を発見して参加申請し、管理者が承認すると
// board_members に追加される。
//
//   - GET  /api/membership-requests/discoverable : 自分の道場に紐づく未所属ボード一覧
//   - GET  /api/membership-requests/mine         : 自分の申請一覧(状態表示用)
//   - POST /api/membership-requests              : 参加申請(申請者本人)
//   - GET  /api/membership-requests?boardId=     : 承認待ち一覧(owner/admin)
//   - POST /api/membership-requests/:id/approve  : 承認(owner/admin)
//   - POST /api/membership-requests/:id/reject   : 却下(owner/admin)

import type { SupabaseClient } from "@supabase/supabase-js";
import { type Context, Hono } from "hono";
import { z } from "zod";
import type { AppBindings, AppVariables } from "../../app.js";
import { logger } from "../../lib/logger.js";
import { authMiddleware } from "../../middleware/auth.js";
import {
  boardAdminMiddleware,
  membershipRequestAdminMiddleware,
} from "../../middleware/boardAccess.js";

type RequestsEnv = { Bindings: AppBindings; Variables: AppVariables };

const requestsRoute = new Hono<RequestsEnv>();

const uuidLike = z
  .string()
  .regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);

const createSchema = z.object({
  boardId: uuidLike,
  message: z.string().max(500).optional(),
});

const parseJson = async (c: Context<RequestsEnv>): Promise<unknown> => {
  try {
    return await c.req.json();
  } catch {
    return undefined;
  }
};

// ログイン中ユーザーの AikiNote 道場 ID を取る。未設定なら null。
const getMyDojoId = async (
  supabase: SupabaseClient,
  userId: string,
): Promise<string | null> => {
  const { data, error } = await supabase
    .from("User")
    .select("dojo_style_id")
    .eq("id", userId)
    .maybeSingle();
  if (error || !data) {
    return null;
  }
  return (data.dojo_style_id as string | null) ?? null;
};

// ────────────────────────────────────────────────────────────────
// GET /discoverable — 自分の道場に紐づく、未所属のボード一覧(+ 自分の申請状態)
// ────────────────────────────────────────────────────────────────
requestsRoute.get("/discoverable", authMiddleware, async (c) => {
  const supabase = c.get("supabase");
  if (!supabase) {
    return c.json({ success: false, error: "サーバー設定が不正です" }, 500);
  }
  const userId = c.get("userId");
  if (!userId) {
    return c.json({ success: false, error: "認証エラー" }, 401);
  }
  const aikiboard = supabase.schema("aikiboard");

  const failWith = (logMessage: string) => {
    logger.error(logMessage, { feature: "membershipRequests", userId });
    return c.json({ success: false, error: "取得に失敗しました" }, 500);
  };

  const dojoId = await getMyDojoId(supabase, userId);
  if (!dojoId) {
    return c.json({ success: true, data: [] });
  }

  const { data: links, error: linksError } = await aikiboard
    .from("board_dojo_masters")
    .select("board_id")
    .eq("dojo_master_id", dojoId);
  if (linksError) {
    return failWith("道場紐付けの取得に失敗");
  }
  const boardIds = [...new Set((links ?? []).map((l) => l.board_id as string))];
  if (boardIds.length === 0) {
    return c.json({ success: true, data: [] });
  }

  const [boardsRes, membershipsRes, requestsRes, membersRes] =
    await Promise.all([
      aikiboard
        .from("boards")
        .select("id, name, slug, is_public")
        .in("id", boardIds),
      aikiboard
        .from("board_members")
        .select("board_id")
        .eq("user_id", userId)
        .in("board_id", boardIds),
      aikiboard
        .from("membership_requests")
        .select("board_id, status")
        .eq("user_id", userId)
        .in("board_id", boardIds),
      aikiboard
        .from("board_members")
        .select("board_id")
        .in("board_id", boardIds),
    ]);
  if (
    boardsRes.error ||
    membershipsRes.error ||
    requestsRes.error ||
    membersRes.error
  ) {
    return failWith("発見可能ボードの関連データ取得に失敗");
  }

  const memberSet = new Set(
    (membershipsRes.data ?? []).map((m) => m.board_id as string),
  );
  // ボードごとの申請状態(pending を優先、無ければ rejected、それも無ければ none)。
  const statusByBoard = new Map<string, "pending" | "rejected">();
  for (const r of requestsRes.data ?? []) {
    const bid = r.board_id as string;
    const s = r.status as string;
    if (s === "pending") {
      statusByBoard.set(bid, "pending");
    } else if (s === "rejected" && statusByBoard.get(bid) !== "pending") {
      statusByBoard.set(bid, "rejected");
    }
  }
  const memberCount = new Map<string, number>();
  for (const m of membersRes.data ?? []) {
    const bid = m.board_id as string;
    memberCount.set(bid, (memberCount.get(bid) ?? 0) + 1);
  }

  const data = (boardsRes.data ?? [])
    .filter((b) => !memberSet.has(b.id as string))
    .map((b) => ({
      id: b.id as string,
      name: b.name as string,
      slug: b.slug as string,
      isPublic: b.is_public as boolean,
      memberCount: memberCount.get(b.id as string) ?? 0,
      requestStatus: statusByBoard.get(b.id as string) ?? null,
    }));

  return c.json({ success: true, data });
});

// ────────────────────────────────────────────────────────────────
// GET /mine — 自分の申請一覧(状態表示用)
// ────────────────────────────────────────────────────────────────
requestsRoute.get("/mine", authMiddleware, async (c) => {
  const supabase = c.get("supabase");
  if (!supabase) {
    return c.json({ success: false, error: "サーバー設定が不正です" }, 500);
  }
  const userId = c.get("userId");
  const aikiboard = supabase.schema("aikiboard");

  const { data: requests, error } = await aikiboard
    .from("membership_requests")
    .select("id, board_id, status, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (error) {
    logger.error("自分の申請取得に失敗", {
      feature: "membershipRequests",
      userId,
    });
    return c.json({ success: false, error: "取得に失敗しました" }, 500);
  }
  const ids = [...new Set((requests ?? []).map((r) => r.board_id as string))];
  const boardById = new Map<string, { name: string; slug: string }>();
  if (ids.length > 0) {
    const { data: boards } = await aikiboard
      .from("boards")
      .select("id, name, slug")
      .in("id", ids);
    for (const b of boards ?? []) {
      boardById.set(b.id, { name: b.name, slug: b.slug });
    }
  }

  const data = (requests ?? []).map((r) => ({
    id: r.id as string,
    boardId: r.board_id as string,
    boardName: boardById.get(r.board_id as string)?.name ?? "",
    boardSlug: boardById.get(r.board_id as string)?.slug ?? "",
    status: r.status as string,
    createdAt: r.created_at as string,
  }));
  return c.json({ success: true, data });
});

// ────────────────────────────────────────────────────────────────
// GET /?boardId= — 承認待ち一覧(owner/admin)
// ────────────────────────────────────────────────────────────────
requestsRoute.get("/", authMiddleware, boardAdminMiddleware, async (c) => {
  const supabase = c.get("supabase");
  if (!supabase) {
    return c.json({ success: false, error: "サーバー設定が不正です" }, 500);
  }
  const boardId = c.get("boardId");
  const aikiboard = supabase.schema("aikiboard");

  const { data: requests, error } = await aikiboard
    .from("membership_requests")
    .select("id, user_id, message, created_at")
    .eq("board_id", boardId)
    .eq("status", "pending")
    .order("created_at", { ascending: true });
  if (error) {
    logger.error("申請一覧の取得に失敗", {
      feature: "membershipRequests",
      boardId,
    });
    return c.json({ success: false, error: "取得に失敗しました" }, 500);
  }

  const ids = [...new Set((requests ?? []).map((r) => r.user_id as string))];
  const userById = new Map<
    string,
    { username: string; profileImageUrl: string | null }
  >();
  if (ids.length > 0) {
    const { data: users } = await supabase
      .from("User")
      .select("id, username, profile_image_url")
      .in("id", ids);
    for (const u of users ?? []) {
      userById.set(u.id, {
        username: u.username ?? "",
        profileImageUrl: u.profile_image_url ?? null,
      });
    }
  }

  const data = (requests ?? []).map((r) => ({
    id: r.id as string,
    userId: r.user_id as string,
    username: userById.get(r.user_id as string)?.username ?? "",
    profileImageUrl: userById.get(r.user_id as string)?.profileImageUrl ?? null,
    message: (r.message as string | null) ?? null,
    createdAt: r.created_at as string,
  }));
  return c.json({ success: true, data });
});

// ────────────────────────────────────────────────────────────────
// POST / — 参加申請(申請者本人)。道場紐付け・未所属・重複申請を検証。
// ────────────────────────────────────────────────────────────────
requestsRoute.post("/", authMiddleware, async (c) => {
  const supabase = c.get("supabase");
  if (!supabase) {
    return c.json({ success: false, error: "サーバー設定が不正です" }, 500);
  }
  const userId = c.get("userId");
  if (!userId) {
    return c.json({ success: false, error: "認証エラー" }, 401);
  }
  const aikiboard = supabase.schema("aikiboard");

  const parsed = createSchema.safeParse(await parseJson(c));
  if (!parsed.success) {
    return c.json({ success: false, error: "入力内容に誤りがあります" }, 400);
  }
  const { boardId, message } = parsed.data;

  const dojoId = await getMyDojoId(supabase, userId);
  if (!dojoId) {
    return c.json(
      {
        success: false,
        error: "AikiNote で所属道場を設定すると申請できます",
      },
      400,
    );
  }

  // ボードが自分の道場に紐づくか。
  const { data: link, error: linkError } = await aikiboard
    .from("board_dojo_masters")
    .select("board_id")
    .eq("board_id", boardId)
    .eq("dojo_master_id", dojoId)
    .maybeSingle();
  if (linkError) {
    logger.error("道場紐付けの確認に失敗", {
      feature: "membershipRequests",
      boardId,
    });
    return c.json({ success: false, error: "申請に失敗しました" }, 500);
  }
  if (!link) {
    return c.json(
      { success: false, error: "この道場ボードには申請できません" },
      403,
    );
  }

  // 既にメンバーなら申請不要。
  const { data: existingMember } = await aikiboard
    .from("board_members")
    .select("role")
    .eq("board_id", boardId)
    .eq("user_id", userId)
    .maybeSingle();
  if (existingMember) {
    return c.json(
      { success: false, error: "すでにこのボードのメンバーです" },
      400,
    );
  }

  // 承認待ちの重複(UNIQUE index でも担保されるが、わかりやすいエラーを返す)。
  const { data: pending } = await aikiboard
    .from("membership_requests")
    .select("id")
    .eq("board_id", boardId)
    .eq("user_id", userId)
    .eq("status", "pending")
    .maybeSingle();
  if (pending) {
    return c.json({ success: false, error: "すでに申請済みです" }, 409);
  }

  const { data, error } = await aikiboard
    .from("membership_requests")
    .insert({
      board_id: boardId,
      user_id: userId,
      message: message ?? null,
      status: "pending",
    })
    .select("id")
    .single();
  if (error || !data) {
    // UNIQUE 違反(競合）は申請済み扱い。
    if ((error as { code?: string } | null)?.code === "23505") {
      return c.json({ success: false, error: "すでに申請済みです" }, 409);
    }
    logger.error("参加申請の作成に失敗", {
      feature: "membershipRequests",
      boardId,
      userId,
    });
    return c.json({ success: false, error: "申請に失敗しました" }, 500);
  }

  logger.info("参加申請を作成した", {
    feature: "membershipRequests",
    boardId,
    userId,
  });
  return c.json({
    success: true,
    data: { id: data.id },
    message: "参加申請を送信しました",
  });
});

// 承認/却下の共通処理。decision="approved" のときは board_members へ追加する。
const decide = async (
  c: Context<RequestsEnv>,
  decision: "approved" | "rejected",
) => {
  const supabase = c.get("supabase");
  if (!supabase) {
    return c.json({ success: false, error: "サーバー設定が不正です" }, 500);
  }
  const actorId = c.get("userId");
  const boardId = c.get("boardId");
  const id = c.req.param("id");
  const aikiboard = supabase.schema("aikiboard");

  const { data: req, error: reqError } = await aikiboard
    .from("membership_requests")
    .select("user_id, status")
    .eq("id", id)
    .maybeSingle();
  if (reqError) {
    logger.error("申請の取得に失敗", {
      feature: "membershipRequests",
      requestId: id,
    });
    return c.json({ success: false, error: "処理に失敗しました" }, 500);
  }
  if (!req) {
    return c.json({ success: false, error: "対象が見つかりません" }, 404);
  }
  if (req.status !== "pending") {
    return c.json({ success: false, error: "すでに処理済みです" }, 400);
  }
  const applicantId = req.user_id as string;

  if (decision === "approved") {
    const { data: existing } = await aikiboard
      .from("board_members")
      .select("role")
      .eq("board_id", boardId)
      .eq("user_id", applicantId)
      .maybeSingle();
    if (!existing) {
      const { error: memberError } = await aikiboard
        .from("board_members")
        .insert({ board_id: boardId, user_id: applicantId, role: "member" });
      if (memberError) {
        logger.error("承認時のメンバー追加に失敗", {
          feature: "membershipRequests",
          boardId,
          applicantId,
        });
        return c.json({ success: false, error: "承認に失敗しました" }, 500);
      }
    }
  }

  const { error: updateError } = await aikiboard
    .from("membership_requests")
    .update({
      status: decision,
      decided_by_user_id: actorId,
      decided_at: new Date().toISOString(),
    })
    .eq("id", id);
  if (updateError) {
    logger.error("申請状態の更新に失敗", {
      feature: "membershipRequests",
      requestId: id,
    });
    return c.json({ success: false, error: "処理に失敗しました" }, 500);
  }

  logger.info("参加申請を処理した", {
    feature: "membershipRequests",
    requestId: id,
    decision,
  });
  return c.json({
    success: true,
    message: decision === "approved" ? "承認しました" : "却下しました",
  });
};

// ────────────────────────────────────────────────────────────────
// POST /:id/approve — 承認(owner/admin)
// ────────────────────────────────────────────────────────────────
requestsRoute.post(
  "/:id/approve",
  authMiddleware,
  membershipRequestAdminMiddleware,
  (c) => decide(c, "approved"),
);

// ────────────────────────────────────────────────────────────────
// POST /:id/reject — 却下(owner/admin)
// ────────────────────────────────────────────────────────────────
requestsRoute.post(
  "/:id/reject",
  authMiddleware,
  membershipRequestAdminMiddleware,
  (c) => decide(c, "rejected"),
);

export default requestsRoute;
