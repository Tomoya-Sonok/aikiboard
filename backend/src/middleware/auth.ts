// JWT 検証ミドルウェアのスタブ。
// Phase 1 で本実装し、Authorization: Bearer <token> から userId を抽出して
// c.set("userId", ...) する想定。Phase 0 では /health のみ提供のため、
// ファイル自体は枠だけ用意して将来の参照点とする。

import type { Context, Next } from "hono";

export const authMiddleware = async (_c: Context, next: Next) => {
  // TODO(Phase 1): Authorization ヘッダから JWT を抽出 → 検証 → c.set("userId", ...)
  return next();
};
