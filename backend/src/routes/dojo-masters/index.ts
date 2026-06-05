// 道場マスタ検索 API。
// ボード作成フォームで既存の public."DojoStyleMaster" を検索・選択するために使う。
// 新規道場追加(public への書き込み)は本 PR の対象外。

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

export default dojoMastersRoute;
