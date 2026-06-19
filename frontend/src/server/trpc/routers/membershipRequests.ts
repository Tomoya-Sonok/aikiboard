// membershipRequests feature router(ADR 0002 B-6)。参加申請の「承認側」(owner/admin)。
// procedure ↔ Hono endpoint は 1:1。
//
// 申請を「発見・送信」する側(discoverable/mine/create)は AikiBoard の画面には置かず、
// AikiNote 側に導線を設ける方針(要件 4.5.2)。backend のエンドポイントは AikiNote から
// 呼ぶ前提で残してある。AikiBoard 側は承認待ち一覧・承認・却下のみを扱う。

import { z } from "zod";
import type { ApiResponse } from "@/lib/types/api";
import type { PendingRequest } from "@/lib/types/membershipRequest";
import { callHonoApi } from "../hono";
import { authenticatedProcedure, createTRPCRouter } from "../index";

const uuidLike = z
  .string()
  .regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);

const authHeader = (accessToken: string) => ({
  Authorization: `Bearer ${accessToken}`,
});

export const membershipRequestsRouter = createTRPCRouter({
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
