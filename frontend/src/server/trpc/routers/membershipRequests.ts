// membershipRequests feature router(ADR 0002 B-6)。AikiNote 道場からの参加申請。
// procedure ↔ Hono endpoint は 1:1。

import { z } from "zod";
import type { ApiResponse } from "@/lib/types/api";
import type {
  DiscoverableBoard,
  MyRequest,
  PendingRequest,
} from "@/lib/types/membershipRequest";
import { callHonoApi } from "../hono";
import { authenticatedProcedure, createTRPCRouter } from "../index";

const uuidLike = z
  .string()
  .regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);

const authHeader = (accessToken: string) => ({
  Authorization: `Bearer ${accessToken}`,
});

export const membershipRequestsRouter = createTRPCRouter({
  // 自分の道場に紐づく未所属ボード一覧(+ 自分の申請状態)。
  discoverable: authenticatedProcedure.query(({ ctx }) =>
    callHonoApi<ApiResponse<DiscoverableBoard[]>>(
      "/api/membership-requests/discoverable",
      { headers: authHeader(ctx.accessToken) },
    ),
  ),

  // 自分の申請一覧。
  mine: authenticatedProcedure.query(({ ctx }) =>
    callHonoApi<ApiResponse<MyRequest[]>>("/api/membership-requests/mine", {
      headers: authHeader(ctx.accessToken),
    }),
  ),

  // 承認待ち一覧(admin)。
  listForBoard: authenticatedProcedure
    .input(z.object({ boardId: uuidLike }))
    .query(({ input, ctx }) => {
      const qs = new URLSearchParams({ boardId: input.boardId });
      return callHonoApi<ApiResponse<PendingRequest[]>>(
        `/api/membership-requests?${qs.toString()}`,
        { headers: authHeader(ctx.accessToken) },
      );
    }),

  // 参加申請(申請者本人)。
  create: authenticatedProcedure
    .input(
      z.object({ boardId: uuidLike, message: z.string().max(500).optional() }),
    )
    .mutation(({ input, ctx }) =>
      callHonoApi<ApiResponse<{ id: string }>>("/api/membership-requests", {
        method: "POST",
        headers: authHeader(ctx.accessToken),
        body: JSON.stringify(input),
      }),
    ),

  // 承認(admin)。
  approve: authenticatedProcedure
    .input(z.object({ id: uuidLike }))
    .mutation(({ input, ctx }) =>
      callHonoApi<ApiResponse<never>>(
        `/api/membership-requests/${input.id}/approve`,
        { method: "POST", headers: authHeader(ctx.accessToken) },
      ),
    ),

  // 却下(admin)。
  reject: authenticatedProcedure
    .input(z.object({ id: uuidLike }))
    .mutation(({ input, ctx }) =>
      callHonoApi<ApiResponse<never>>(
        `/api/membership-requests/${input.id}/reject`,
        { method: "POST", headers: authHeader(ctx.accessToken) },
      ),
    ),
});
