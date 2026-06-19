// members feature router(ADR 0002 B-6)。tRPC procedure ↔ Hono endpoint は 1:1。
// 一覧(メンバー)/ 管理者によるメンバー削除 / 自主退会。

import { z } from "zod";
import type { ApiResponse } from "@/lib/types/api";
import type { BoardMember } from "@/lib/types/member";
import { callHonoApi } from "../hono";
import { authenticatedProcedure, createTRPCRouter } from "../index";

const uuidLike = z
  .string()
  .regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);

const authHeader = (accessToken: string) => ({
  Authorization: `Bearer ${accessToken}`,
});

export const membersRouter = createTRPCRouter({
  list: authenticatedProcedure
    .input(z.object({ boardId: uuidLike }))
    .query(({ input, ctx }) => {
      const qs = new URLSearchParams({ boardId: input.boardId });
      return callHonoApi<ApiResponse<BoardMember[]>>(
        `/api/members?${qs.toString()}`,
        { headers: authHeader(ctx.accessToken) },
      );
    }),

  // 管理者がメンバーを削除(owner / 自分自身は不可)。
  remove: authenticatedProcedure
    .input(z.object({ boardId: uuidLike, userId: z.string() }))
    .mutation(({ input, ctx }) => {
      const qs = new URLSearchParams({ boardId: input.boardId });
      return callHonoApi<ApiResponse<never>>(
        `/api/members/${input.userId}?${qs.toString()}`,
        { method: "DELETE", headers: authHeader(ctx.accessToken) },
      );
    }),

  // 自主退会(owner は不可)。
  leave: authenticatedProcedure
    .input(z.object({ boardId: uuidLike }))
    .mutation(({ input, ctx }) =>
      callHonoApi<ApiResponse<never>>("/api/members/leave", {
        method: "POST",
        headers: authHeader(ctx.accessToken),
        body: JSON.stringify(input),
      }),
    ),
});
