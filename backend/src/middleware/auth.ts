// JWT 認証ミドルウェア。
// ADR 0002 B-5(追補): Supabase access_token を検証し、payload.sub
// (= auth.users.id = public."User".id)を c.set("userId", ...) する。
// 検証は alg で分岐(ES256 → JWKS / HS256 → SUPABASE_JWT_SECRET)。詳細は lib/jwt.ts。
// 自前 JWT 生成(generateToken)は持たない。

import { createMiddleware } from "hono/factory";
import type { AppBindings, AppVariables } from "../app.js";
import { extractTokenFromHeader, verifySupabaseToken } from "../lib/jwt.js";
import { logger } from "../lib/logger.js";

const getProcessEnv = (key: string): string | undefined =>
  typeof process !== "undefined" ? process.env?.[key] : undefined;

export const authMiddleware = createMiddleware<{
  Bindings: AppBindings;
  Variables: AppVariables;
}>(async (c, next) => {
  const supabaseUrl = c.env?.SUPABASE_URL ?? getProcessEnv("SUPABASE_URL");
  const hs256Secret =
    c.env?.SUPABASE_JWT_SECRET ?? getProcessEnv("SUPABASE_JWT_SECRET");

  try {
    const token = extractTokenFromHeader(c.req.header("Authorization"));
    const payload = await verifySupabaseToken(token, {
      supabaseUrl,
      hs256Secret,
    });

    if (!payload.sub) {
      return c.json({ success: false, error: "認証エラー" }, 401);
    }

    c.set("userId", payload.sub);
    return next();
  } catch (error) {
    logger.warn("access_token の検証に失敗", {
      feature: "auth",
      reason: error instanceof Error ? error.message : "unknown",
    });
    return c.json({ success: false, error: "認証エラー" }, 401);
  }
});
