// 有料機能(feature_flag)ゲート。boardMember/boardAdmin の後段で使う。
// c.get("boardId") は前段のミドルウェアが設定済みであることを前提とする。
// 機能が契約プランに含まれなければ 403(code: "feature_locked")を返す。

import { createMiddleware } from "hono/factory";
import type { AppBindings, AppVariables } from "../app.js";
import { getEntitledFeatures } from "../lib/features.js";

type GuardEnv = { Bindings: AppBindings; Variables: AppVariables };

export const requireFeature = (featureCode: string) =>
  createMiddleware<GuardEnv>(async (c, next) => {
    const supabase = c.get("supabase");
    const boardId = c.get("boardId");
    if (!supabase || !boardId) {
      return c.json({ success: false, error: "権限の確認に失敗しました" }, 500);
    }
    const features = await getEntitledFeatures(supabase, boardId);
    if (!features.has(featureCode)) {
      return c.json(
        {
          success: false,
          error: "このプランではご利用いただけません",
          code: "feature_locked",
        },
        403,
      );
    }
    return next();
  });
