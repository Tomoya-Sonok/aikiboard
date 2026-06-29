// アクティビティログ feature router(ADR 0002 B-6)。管理者 + 有料機能。

import { z } from "zod";
import type { ActivityListResult } from "@/lib/types/activity";
import type { ApiResponse } from "@/lib/types/api";
import { callHonoApi } from "../hono";
import { authenticatedProcedure, createTRPCRouter } from "../index";

const uuidLike = z
  .string()
  .regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);

const authHeader = (accessToken: string) => ({
  Authorization: `Bearer ${accessToken}`,
});

export const activityLogsRouter = createTRPCRouter({
  list: authenticatedProcedure
    .input(
      z.object({
        boardId: uuidLike,
        limit: z.number().int().min(1).max(100).optional(),
        offset: z.number().int().min(0).optional(),
      }),
    )
    .query(({ input, ctx }) => {
      const qs = new URLSearchParams({ boardId: input.boardId });
      if (input.limit != null) qs.set("limit", String(input.limit));
      if (input.offset != null) qs.set("offset", String(input.offset));
      return callHonoApi<ApiResponse<ActivityListResult>>(
        `/api/activity-logs?${qs.toString()}`,
        { headers: authHeader(ctx.accessToken) },
      );
    }),
});
