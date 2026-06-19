// invitations feature router(ADR 0002 B-6)。共有招待リンクの発行・一覧・失効と、
// token によるプレビュー・参加。procedure ↔ Hono endpoint は 1:1。

import { z } from "zod";
import type { ApiResponse } from "@/lib/types/api";
import type {
  Invitation,
  InviteJoinResult,
  InvitePreview,
} from "@/lib/types/invitation";
import { callHonoApi } from "../hono";
import { authenticatedProcedure, createTRPCRouter } from "../index";

const uuidLike = z
  .string()
  .regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);

const authHeader = (accessToken: string) => ({
  Authorization: `Bearer ${accessToken}`,
});

export const invitationsRouter = createTRPCRouter({
  // 有効な招待一覧(admin)。
  list: authenticatedProcedure
    .input(z.object({ boardId: uuidLike }))
    .query(({ input, ctx }) => {
      const qs = new URLSearchParams({ boardId: input.boardId });
      return callHonoApi<ApiResponse<Invitation[]>>(
        `/api/invitations?${qs.toString()}`,
        { headers: authHeader(ctx.accessToken) },
      );
    }),

  // 招待リンクを発行(admin)。
  create: authenticatedProcedure
    .input(
      z.object({
        boardId: uuidLike,
        expiresInDays: z.number().int().min(1).max(365).optional(),
        label: z.string().max(100).optional(),
      }),
    )
    .mutation(({ input, ctx }) =>
      callHonoApi<ApiResponse<Invitation>>("/api/invitations", {
        method: "POST",
        headers: authHeader(ctx.accessToken),
        body: JSON.stringify(input),
      }),
    ),

  // 招待リンクを失効(admin)。
  revoke: authenticatedProcedure
    .input(z.object({ id: uuidLike }))
    .mutation(({ input, ctx }) =>
      callHonoApi<ApiResponse<never>>(`/api/invitations/${input.id}/revoke`, {
        method: "POST",
        headers: authHeader(ctx.accessToken),
      }),
    ),

  // token のプレビュー(認証ユーザー、非メンバー可)。
  preview: authenticatedProcedure
    .input(z.object({ token: z.string().min(1) }))
    .query(({ input, ctx }) =>
      callHonoApi<ApiResponse<InvitePreview>>(
        `/api/invitations/token/${encodeURIComponent(input.token)}`,
        { headers: authHeader(ctx.accessToken) },
      ),
    ),

  // token で参加(認証ユーザー)。
  join: authenticatedProcedure
    .input(z.object({ token: z.string().min(1) }))
    .mutation(({ input, ctx }) =>
      callHonoApi<ApiResponse<InviteJoinResult>>(
        `/api/invitations/token/${encodeURIComponent(input.token)}/join`,
        { method: "POST", headers: authHeader(ctx.accessToken) },
      ),
    ),
});
