// 道場マスタ API(検索 + 新規追加)。
// ボード作成フォームで既存の public."DojoStyleMaster" を検索・選択する。
//
// 新規道場追加(双方向書き込み、要件 5.2): AikiNote と共有する public."DojoStyleMaster" に
// 行を追加する(AikiNote 側にも反映される)。重複は正規化名で防止し、未承認(is_approved=false)
// + created_by_user_id 付きで作る(AikiNote の作成者 + モデレーションモデルに準拠)。
// 検索は承認済みのみ返すため、追加直後の道場は本 API の戻り値(id)で直接ボードに紐付ける。

import { Hono } from "hono";
import { z } from "zod";
import type { AppBindings, AppVariables } from "../../app.js";
import { logger } from "../../lib/logger.js";
import { authMiddleware } from "../../middleware/auth.js";

const dojoMastersRoute = new Hono<{
  Bindings: AppBindings;
  Variables: AppVariables;
}>();

const querySchema = z.object({
  q: z.string().trim().max(100).optional(),
  limit: z.coerce.number().int().min(1).max(50).optional(),
});

// PostgREST の or() フィルタ文字列に値を埋め込むため、区切り/ワイルドカード文字を除去する。
const sanitizeQuery = (value: string): string =>
  value.replace(/[,()%*\\]/g, "").trim();

// GET /api/dojo-masters?q=&limit= — 承認済み道場を名称/かなで部分一致検索。
dojoMastersRoute.get("/", authMiddleware, async (c) => {
  const supabase = c.get("supabase");
  if (!supabase) {
    return c.json({ success: false, error: "サーバー設定が不正です" }, 500);
  }

  const parsed = querySchema.safeParse({
    q: c.req.query("q"),
    limit: c.req.query("limit"),
  });
  if (!parsed.success) {
    return c.json({ success: false, error: "入力内容に誤りがあります" }, 400);
  }
  const limit = parsed.data.limit ?? 20;

  let query = supabase
    .from("DojoStyleMaster")
    .select("id, dojo_name, dojo_name_kana, is_approved")
    .eq("is_approved", true)
    .order("dojo_name")
    .limit(limit);

  const q = parsed.data.q ? sanitizeQuery(parsed.data.q) : "";
  if (q) {
    query = query.or(`dojo_name.ilike.%${q}%,dojo_name_kana.ilike.%${q}%`);
  }

  const { data, error } = await query;
  if (error) {
    logger.error("道場マスタの検索に失敗", { feature: "dojo-masters" });
    return c.json({ success: false, error: "道場の検索に失敗しました" }, 500);
  }

  return c.json({ success: true, data: data ?? [] });
});

const createSchema = z.object({
  dojoName: z.string().trim().min(1).max(100),
  dojoNameKana: z.string().trim().max(100).optional(),
  region: z.string().trim().max(100).optional(),
});

// POST /api/dojo-masters — 新規道場を追加(双方向書き込み、要件 5.2)。
//   認証ユーザーが申請でき、未承認 + created_by_user_id 付きで作る。
//   既存(正規化名で一致)があればそれを返す(重複防止・冪等)。
dojoMastersRoute.post("/", authMiddleware, async (c) => {
  const supabase = c.get("supabase");
  if (!supabase) {
    return c.json({ success: false, error: "サーバー設定が不正です" }, 500);
  }
  const userId = c.get("userId");

  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    body = undefined;
  }
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ success: false, error: "入力内容に誤りがあります" }, 400);
  }
  // 連続空白を 1 つに畳んで正規化(表記ゆれの軽減)。
  const dojoName = parsed.data.dojoName.replace(/\s+/g, " ").trim();
  const dojoNameKana = parsed.data.dojoNameKana?.replace(/\s+/g, " ").trim();

  // 既存チェック(大文字小文字無視の完全一致)。あれば再利用して重複を防ぐ。
  const { data: existing, error: existingError } = await supabase
    .from("DojoStyleMaster")
    .select("id, dojo_name, dojo_name_kana, is_approved")
    .ilike("dojo_name", dojoName)
    .maybeSingle();
  if (existingError) {
    logger.error("道場マスタの重複確認に失敗", { feature: "dojo-masters" });
    return c.json({ success: false, error: "道場の追加に失敗しました" }, 500);
  }
  if (existing) {
    return c.json({ success: true, data: { ...existing, existed: true } });
  }

  const { data, error } = await supabase
    .from("DojoStyleMaster")
    .insert({
      dojo_name: dojoName,
      dojo_name_kana: dojoNameKana || null,
      region: parsed.data.region || null,
      is_approved: false,
      created_by_user_id: userId,
    })
    .select("id, dojo_name, dojo_name_kana, is_approved")
    .single();
  if (error || !data) {
    logger.error("道場マスタの追加に失敗", {
      feature: "dojo-masters",
      userId,
      error: error?.message,
    });
    return c.json({ success: false, error: "道場の追加に失敗しました" }, 500);
  }

  logger.info("道場マスタに新規追加した", {
    feature: "dojo-masters",
    userId,
    dojoMasterId: data.id,
  });
  return c.json({
    success: true,
    data: { ...data, existed: false },
    message: "道場を追加しました",
  });
});

export default dojoMastersRoute;
