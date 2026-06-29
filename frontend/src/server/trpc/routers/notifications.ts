// 通知 feature router(ADR 0002 B-6)。tRPC procedure ↔ Hono endpoint は 1:1。
// 一覧・未読数(メンバー)、既読・全既読・削除。

import { z } from "zod";
import type { ApiResponse } from "@/lib/types/api";
import type { NotificationListResult } from "@/lib/types/notification";
import { callHonoApi } from "../hono";
import { authenticatedProcedure, createTRPCRouter } from "../index";

const uuidLike = z
  .string()
  .regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);

const authHeader = (accessToken: string) => ({
  Authorization: `Bearer ${accessToken}`,
});

export const notificationsRouter = createTRPCRouter({
  // 通知一覧(新しい順)。
  list: authenticatedProcedure
    .input(
      z.object({
        boardId: uuidLike,
        limit: z.number().int().min(1).max(50).optional(),
        offset: z.number().int().min(0).optional(),
      }),
    )
    .query(({ input, ctx }) => {
      const qs = new URLSearchParams({ boardId: input.boardId });
      if (input.limit != null) qs.set("limit", String(input.limit));
      if (input.offset != null) qs.set("offset", String(input.offset));
      return callHonoApi<ApiResponse<NotificationListResult>>(
        `/api/notifications?${qs.toString()}`,
        { headers: authHeader(ctx.accessToken) },
      );
    }),

  // 未読数(ベルバッジ用)。
  unreadCount: authenticatedProcedure
    .input(z.object({ boardId: uuidLike }))
    .query(({ input, ctx }) => {
      const qs = new URLSearchParams({ boardId: input.boardId });
      return callHonoApi<ApiResponse<{ count: number }>>(
        `/api/notifications/unread-count?${qs.toString()}`,
        { headers: authHeader(ctx.accessToken) },
      );
    }),

  // 1 件既読。
  markRead: authenticatedProcedure
    .input(z.object({ id: uuidLike }))
    .mutation(({ input, ctx }) =>
      callHonoApi<ApiResponse<never>>(`/api/notifications/${input.id}/read`, {
        method: "PUT",
        headers: authHeader(ctx.accessToken),
      }),
    ),

  // 全既読。
  markAllRead: authenticatedProcedure
    .input(z.object({ boardId: uuidLike }))
    .mutation(({ input, ctx }) => {
      const qs = new URLSearchParams({ boardId: input.boardId });
      return callHonoApi<ApiResponse<never>>(
        `/api/notifications/read-all?${qs.toString()}`,
        { method: "POST", headers: authHeader(ctx.accessToken) },
      );
    }),

  // 1 件削除。
  remove: authenticatedProcedure
    .input(z.object({ id: uuidLike }))
    .mutation(({ input, ctx }) =>
      callHonoApi<ApiResponse<never>>(`/api/notifications/${input.id}`, {
        method: "DELETE",
        headers: authHeader(ctx.accessToken),
      }),
    ),
});
