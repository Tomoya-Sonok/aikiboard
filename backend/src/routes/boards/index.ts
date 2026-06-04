// ボード作成 API。
// ボード作成は RLS の鶏卵問題(owner の board_members を作る権限が、まだ owner で
// ないため通らない)があるため、backend の service_role(RLS バイパス)で作成する。
// aikiboard スキーマは REST 公開済み(config.toml [api] schemas)+ service_role 権限(009)。
//
// 1 トランザクションにできない(supabase-js は HTTP リクエスト単位)ため、
// boards INSERT 後に関連行を入れ、途中失敗時は board を delete して
// ロールバックする(board_* は ON DELETE CASCADE)。

import { Hono } from "hono";
import { z } from "zod";
import type { AppBindings, AppVariables } from "../../app.js";
import { logger } from "../../lib/logger.js";
import { authMiddleware } from "../../middleware/auth.js";

const boardsRoute = new Hono<{
  Bindings: AppBindings;
  Variables: AppVariables;
}>();

// 公開 URL `/d/<slug>` 用。英小文字・数字・ハイフン、先頭末尾は英数字。
const slugRegex = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/;

// Postgres uuid 型が受理する形式(任意 hex)。z.uuid() は RFC のバージョン桁を要求し、
// seed の `00000000-...-000000000001` 等を弾くため、ここでは緩く hex 形式で検証する。
const uuidLike = z
  .string()
  .regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);

const createBoardSchema = z.object({
  name: z.string().min(1).max(50),
  slug: z.string().min(3).max(63).regex(slugRegex),
  isPublic: z.boolean(),
  description: z.string().max(500).optional(),
  dojoMasterIds: z.array(uuidLike).min(1).max(10),
});

// GET /api/boards — ログイン中ユーザーの所属ボード一覧(認証必須)。
// board_members を起点に、各ボードへ role / プラン名 / メンバー数を付けて返す。
// 実体は service_role(RLS バイパス)で読むため、所属判定は board_members で行う。
boardsRoute.get("/", authMiddleware, async (c) => {
  const supabase = c.get("supabase");
  if (!supabase) {
    return c.json({ success: false, error: "サーバー設定が不正です" }, 500);
  }
  const userId = c.get("userId");
  const aikiboard = supabase.schema("aikiboard");

  // 所属(role / joined_at)。joined_at 昇順 = 先頭がデフォルトボード候補。
  const { data: memberships, error: membershipError } = await aikiboard
    .from("board_members")
    .select("board_id, role, joined_at")
    .eq("user_id", userId)
    .order("joined_at", { ascending: true });
  if (membershipError) {
    logger.error("所属ボードの取得に失敗", { feature: "boards", userId });
    return c.json(
      { success: false, error: "ボード一覧の取得に失敗しました" },
      500,
    );
  }
  if (!memberships || memberships.length === 0) {
    return c.json({ success: true, data: [] });
  }

  const boardIds = memberships.map((m) => m.board_id);

  // ボード本体 / メンバー数 / サブスクをまとめて取得。
  const [boardsRes, membersRes, subsRes] = await Promise.all([
    aikiboard
      .from("boards")
      .select("id, name, slug, is_public")
      .in("id", boardIds),
    aikiboard.from("board_members").select("board_id").in("board_id", boardIds),
    aikiboard
      .from("board_subscriptions")
      .select("board_id, plan_id")
      .in("board_id", boardIds),
  ]);
  if (boardsRes.error || membersRes.error || subsRes.error || !boardsRes.data) {
    logger.error("ボード一覧の関連データ取得に失敗", { feature: "boards" });
    return c.json(
      { success: false, error: "ボード一覧の取得に失敗しました" },
      500,
    );
  }

  // プラン名(サブスク → plans)。サブスク無しのボードは Free にフォールバック。
  const planIdByBoard = new Map<string, string>();
  for (const row of subsRes.data ?? []) {
    planIdByBoard.set(row.board_id, row.plan_id);
  }
  const planIds = [...new Set(planIdByBoard.values())];
  const planById = new Map<string, { code: string; name: string }>();
  if (planIds.length > 0) {
    const { data: plans, error: plansError } = await aikiboard
      .from("plans")
      .select("id, code, name")
      .in("id", planIds);
    if (plansError) {
      logger.error("プランの取得に失敗", { feature: "boards" });
      return c.json(
        { success: false, error: "ボード一覧の取得に失敗しました" },
        500,
      );
    }
    for (const p of plans ?? []) {
      planById.set(p.id, { code: p.code, name: p.name });
    }
  }

  // メンバー数を集計。
  const memberCountByBoard = new Map<string, number>();
  for (const row of membersRes.data ?? []) {
    memberCountByBoard.set(
      row.board_id,
      (memberCountByBoard.get(row.board_id) ?? 0) + 1,
    );
  }

  const boardById = new Map(boardsRes.data.map((b) => [b.id, b]));
  const freePlan = { code: "free", name: "Free" };

  // memberships の順(joined_at 昇順)を維持して整形。
  const data = [];
  for (const m of memberships) {
    const board = boardById.get(m.board_id);
    if (!board) {
      continue;
    }
    const planId = planIdByBoard.get(m.board_id);
    const plan = (planId && planById.get(planId)) || freePlan;
    data.push({
      id: board.id,
      name: board.name,
      slug: board.slug,
      isPublic: board.is_public,
      role: m.role,
      planCode: plan.code,
      planName: plan.name,
      memberCount: memberCountByBoard.get(m.board_id) ?? 0,
    });
  }

  return c.json({ success: true, data });
});

// POST /api/boards — ボード作成(認証必須、作成者が owner になる)。
boardsRoute.post("/", authMiddleware, async (c) => {
  const supabase = c.get("supabase");
  if (!supabase) {
    return c.json({ success: false, error: "サーバー設定が不正です" }, 500);
  }
  const userId = c.get("userId");

  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json(
      { success: false, error: "リクエストの形式が正しくありません" },
      400,
    );
  }

  const parsed = createBoardSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ success: false, error: "入力内容に誤りがあります" }, 400);
  }
  const { name, slug, isPublic, description, dojoMasterIds } = parsed.data;
  const uniqueDojoIds = [...new Set(dojoMasterIds)];

  const aikiboard = supabase.schema("aikiboard");

  // slug の一意性チェック(事前)。INSERT 時の unique 違反も backstop する。
  const { data: existing, error: slugError } = await aikiboard
    .from("boards")
    .select("id")
    .eq("slug", slug)
    .maybeSingle();
  if (slugError) {
    logger.error("slug 重複チェックに失敗", { feature: "boards" });
    return c.json({ success: false, error: "ボード作成に失敗しました" }, 500);
  }
  if (existing) {
    return c.json(
      { success: false, error: "この URL は既に使われています" },
      409,
    );
  }

  // 道場マスタの存在チェック(public."DojoStyleMaster")
  const { data: dojos, error: dojoError } = await supabase
    .from("DojoStyleMaster")
    .select("id")
    .in("id", uniqueDojoIds);
  if (dojoError) {
    logger.error("道場マスタの存在チェックに失敗", { feature: "boards" });
    return c.json({ success: false, error: "ボード作成に失敗しました" }, 500);
  }
  if (!dojos || dojos.length !== uniqueDojoIds.length) {
    return c.json(
      { success: false, error: "選択した道場が見つかりません" },
      400,
    );
  }

  // ボード本体を作成
  const { data: board, error: boardError } = await aikiboard
    .from("boards")
    .insert({ name, slug, created_by_user_id: userId, is_public: isPublic })
    .select("id, name, slug, is_public")
    .single();
  if (boardError || !board) {
    if (boardError?.code === "23505") {
      return c.json(
        { success: false, error: "この URL は既に使われています" },
        409,
      );
    }
    logger.error("boards の INSERT に失敗", { feature: "boards" });
    return c.json({ success: false, error: "ボード作成に失敗しました" }, 500);
  }
  const boardId = board.id as string;

  // 関連行を作成。途中失敗時は board を delete してロールバック。
  try {
    const { error: memberError } = await aikiboard
      .from("board_members")
      .insert({ board_id: boardId, user_id: userId, role: "owner" });
    if (memberError) {
      throw memberError;
    }

    const { error: settingsError } = await aikiboard
      .from("board_settings")
      .insert({ board_id: boardId, description: description ?? null });
    if (settingsError) {
      throw settingsError;
    }

    const dojoRows = uniqueDojoIds.map((id, index) => ({
      board_id: boardId,
      dojo_master_id: id,
      is_primary: index === 0,
    }));
    const { error: dojoInsertError } = await aikiboard
      .from("board_dojo_masters")
      .insert(dojoRows);
    if (dojoInsertError) {
      throw dojoInsertError;
    }

    // 新規ボードは Free プランから開始する。プラン別機能判定(hasFeature)や
    // サイドバーのプラン表示の基準として board_subscriptions を 1 行作る。
    // plans の seed は migration 007 で投入済み。
    const { data: freePlan, error: freePlanError } = await aikiboard
      .from("plans")
      .select("id")
      .eq("code", "free")
      .maybeSingle();
    if (freePlanError || !freePlan) {
      throw freePlanError ?? new Error("free プランが見つかりません");
    }
    const { error: subscriptionError } = await aikiboard
      .from("board_subscriptions")
      .insert({ board_id: boardId, plan_id: freePlan.id, status: "active" });
    if (subscriptionError) {
      throw subscriptionError;
    }
  } catch (_error) {
    await aikiboard.from("boards").delete().eq("id", boardId);
    logger.error("ボード関連行の INSERT に失敗し board をロールバック", {
      feature: "boards",
      boardId,
    });
    return c.json({ success: false, error: "ボード作成に失敗しました" }, 500);
  }

  logger.info("ボードを作成した", { feature: "boards", boardId, userId });
  return c.json({
    success: true,
    data: board,
    message: "ボードを作成しました",
  });
});

export default boardsRoute;
