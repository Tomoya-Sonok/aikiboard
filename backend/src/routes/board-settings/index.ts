// ボード設定 API(要件 4.7 道場ページの管理、9.4 テーマカラー)。
//
//   - GET   /api/board-settings?boardId=  : 現在の設定(メンバー)
//   - PATCH /api/board-settings           : 設定更新(owner/admin)
//
// 公開ページの表示内容(ロゴ・テーマ・基本情報・問い合わせ導線・公開フラグ)を管理する。
// 公開フラグ(boards.is_public)と board_settings を一括で扱う。
// 認可は boardAccess ミドルウェア(backend は service_role で RLS バイパスのため唯一の砦)。
//
// 注: 厳密なプラン制限(テーマ変更・公開ページは有料: 6.2)は決済実装後に requireFeature で
// 絞る余地を残す。現状は管理者なら保存でき、公開ページの anon 表示は is_public で制御する。

import { type Context, Hono } from "hono";
import { z } from "zod";
import type { AppBindings, AppVariables } from "../../app.js";
import { logger } from "../../lib/logger.js";
import { authMiddleware } from "../../middleware/auth.js";
import {
  boardAdminMiddleware,
  boardMemberMiddleware,
} from "../../middleware/boardAccess.js";

type SettingsEnv = { Bindings: AppBindings; Variables: AppVariables };

const boardSettingsRoute = new Hono<SettingsEnv>();

// 10 色プリセット(9.4)。
const THEME_CODES = [
  "sumi",
  "dou",
  "fukamidori",
  "ai",
  "enji",
  "yamabuki",
  "shikon",
  "toki",
  "usuzumi",
  "nezumi",
] as const;

// 公開ページの表示設定(問い合わせ先・指導者紹介・アクセス等のブロック)。
const publicPageConfigSchema = z
  .object({
    instructorIntro: z.string().max(2000).optional(),
    access: z.string().max(1000).optional(),
    organization: z.string().max(200).optional(),
    contactEmail: z.string().email().max(200).optional().or(z.literal("")),
    contactPhone: z.string().max(50).optional(),
    contactUrl: z.string().url().max(500).optional().or(z.literal("")),
    showCalendar: z.boolean().optional(),
    showContact: z.boolean().optional(),
  })
  .strip();

const updateSchema = z.object({
  description: z.string().max(2000).nullable().optional(),
  themeColorCode: z.enum(THEME_CODES).optional(),
  logoUrl: z.string().url().max(1000).nullable().optional(),
  isPublic: z.boolean().optional(),
  publicPageConfig: publicPageConfigSchema.optional(),
});

const parseJson = async (
  c: Context<SettingsEnv>,
): Promise<unknown | undefined> => {
  try {
    return await c.req.json();
  } catch {
    return undefined;
  }
};

// GET /api/board-settings?boardId= — 現在の設定(メンバー)。
boardSettingsRoute.get(
  "/",
  authMiddleware,
  boardMemberMiddleware,
  async (c) => {
    const supabase = c.get("supabase");
    if (!supabase) {
      return c.json({ success: false, error: "サーバー設定が不正です" }, 500);
    }
    const boardId = c.get("boardId");
    const aikiboard = supabase.schema("aikiboard");

    const [settingsRes, boardRes] = await Promise.all([
      aikiboard
        .from("board_settings")
        .select("logo_url, theme_color_code, description, public_page_config")
        .eq("board_id", boardId)
        .maybeSingle(),
      aikiboard
        .from("boards")
        .select("is_public")
        .eq("id", boardId)
        .maybeSingle(),
    ]);
    if (settingsRes.error || boardRes.error) {
      logger.error("ボード設定の取得に失敗", {
        feature: "board-settings",
        boardId,
      });
      return c.json({ success: false, error: "設定の取得に失敗しました" }, 500);
    }

    return c.json({
      success: true,
      data: {
        logoUrl: (settingsRes.data?.logo_url as string | null) ?? null,
        themeColorCode:
          (settingsRes.data?.theme_color_code as string | null) ?? "sumi",
        description: (settingsRes.data?.description as string | null) ?? null,
        publicPageConfig: settingsRes.data?.public_page_config ?? {},
        isPublic: (boardRes.data?.is_public as boolean | null) ?? false,
      },
    });
  },
);

// PATCH /api/board-settings — 設定更新(owner/admin)。
boardSettingsRoute.patch(
  "/",
  authMiddleware,
  boardAdminMiddleware,
  async (c) => {
    const supabase = c.get("supabase");
    if (!supabase) {
      return c.json({ success: false, error: "サーバー設定が不正です" }, 500);
    }
    const boardId = c.get("boardId") as string;
    const aikiboard = supabase.schema("aikiboard");

    const parsed = updateSchema.safeParse(await parseJson(c));
    if (!parsed.success) {
      return c.json({ success: false, error: "入力内容に誤りがあります" }, 400);
    }
    const p = parsed.data;

    // board_settings 側の更新(upsert: 設定行が無いボードにも対応)。
    const settingsUpdate: Record<string, unknown> = { board_id: boardId };
    if (p.description !== undefined) settingsUpdate.description = p.description;
    if (p.themeColorCode !== undefined)
      settingsUpdate.theme_color_code = p.themeColorCode;
    if (p.logoUrl !== undefined) settingsUpdate.logo_url = p.logoUrl;
    if (p.publicPageConfig !== undefined)
      settingsUpdate.public_page_config = p.publicPageConfig;

    if (Object.keys(settingsUpdate).length > 1) {
      const { error } = await aikiboard
        .from("board_settings")
        .upsert(settingsUpdate, { onConflict: "board_id" });
      if (error) {
        logger.error("ボード設定の更新に失敗", {
          feature: "board-settings",
          boardId,
        });
        return c.json(
          { success: false, error: "設定の更新に失敗しました" },
          500,
        );
      }
    }

    // 公開フラグ(boards.is_public)の更新。
    if (p.isPublic !== undefined) {
      const { error } = await aikiboard
        .from("boards")
        .update({ is_public: p.isPublic })
        .eq("id", boardId);
      if (error) {
        logger.error("公開フラグの更新に失敗", {
          feature: "board-settings",
          boardId,
        });
        return c.json(
          { success: false, error: "設定の更新に失敗しました" },
          500,
        );
      }
    }

    return c.json({ success: true, message: "設定を更新しました" });
  },
);

export default boardSettingsRoute;
