// ボード設定 feature router(ADR 0002 B-6)。GET(メンバー)/ update(owner/admin)。

import { z } from "zod";
import type { ApiResponse } from "@/lib/types/api";
import type { BoardSettings } from "@/lib/types/publicBoard";
import { callHonoApi } from "../hono";
import { authenticatedProcedure, createTRPCRouter } from "../index";

const uuidLike = z
  .string()
  .regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);

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

const publicPageConfig = z
  .object({
    instructorIntro: z.string().max(2000).optional(),
    access: z.string().max(1000).optional(),
    organization: z.string().max(200).optional(),
    contactEmail: z.string().max(200).optional(),
    contactPhone: z.string().max(50).optional(),
    contactUrl: z.string().max(500).optional(),
    showCalendar: z.boolean().optional(),
    showContact: z.boolean().optional(),
  })
  .optional();

const authHeader = (accessToken: string) => ({
  Authorization: `Bearer ${accessToken}`,
});

export const boardSettingsRouter = createTRPCRouter({
  get: authenticatedProcedure
    .input(z.object({ boardId: uuidLike }))
    .query(({ input, ctx }) => {
      const qs = new URLSearchParams({ boardId: input.boardId });
      return callHonoApi<ApiResponse<BoardSettings>>(
        `/api/board-settings?${qs.toString()}`,
        { headers: authHeader(ctx.accessToken) },
      );
    }),

  update: authenticatedProcedure
    .input(
      z.object({
        boardId: uuidLike,
        description: z.string().max(2000).nullable().optional(),
        themeColorCode: z.enum(THEME_CODES).optional(),
        logoUrl: z.string().max(1000).nullable().optional(),
        isPublic: z.boolean().optional(),
        publicPageConfig,
      }),
    )
    .mutation(({ input, ctx }) =>
      // boardId は boardAccess ミドルウェアが body から解決する。設定フィールドは
      // backend の zod が検証(boardId は未知キーとして無視される)。
      callHonoApi<ApiResponse<never>>("/api/board-settings", {
        method: "PATCH",
        headers: authHeader(ctx.accessToken),
        body: JSON.stringify(input),
      }),
    ),
});
