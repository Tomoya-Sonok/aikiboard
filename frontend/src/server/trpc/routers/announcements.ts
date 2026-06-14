// announcements feature router(ADR 0002 B-6)。tRPC procedure ↔ Hono endpoint は 1:1。
// 一覧・未読数・詳細(閲覧)、作成・編集・公開・削除(管理者)、既読(メンバー)。

import { z } from "zod";
import type {
  AnnouncementDetail,
  AnnouncementListResult,
} from "@/lib/types/announcement";
import type { ApiResponse } from "@/lib/types/api";
import { callHonoApi } from "../hono";
import { authenticatedProcedure, createTRPCRouter } from "../index";

const uuidLike = z
  .string()
  .regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);

// body_rich(ProseMirror JSON)。構造の検証は backend の richtext.ts が担う。
const bodyRich = z.unknown();

const authHeader = (accessToken: string) => ({
  Authorization: `Bearer ${accessToken}`,
});

export const announcementsRouter = createTRPCRouter({
  // 一覧(member は公開済みのみ、admin は下書きも先頭に)。
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
      return callHonoApi<ApiResponse<AnnouncementListResult>>(
        `/api/announcements?${qs.toString()}`,
        { headers: authHeader(ctx.accessToken) },
      );
    }),

  // 未読数(公開済みのうち未読の件数)。バッジ用。
  unreadCount: authenticatedProcedure
    .input(z.object({ boardId: uuidLike }))
    .query(({ input, ctx }) => {
      const qs = new URLSearchParams({ boardId: input.boardId });
      return callHonoApi<ApiResponse<{ count: number }>>(
        `/api/announcements/unread-count?${qs.toString()}`,
        { headers: authHeader(ctx.accessToken) },
      );
    }),

  // 詳細(本文全文)。下書きは管理者のみ。
  detail: authenticatedProcedure
    .input(z.object({ id: uuidLike }))
    .query(({ input, ctx }) =>
      callHonoApi<ApiResponse<AnnouncementDetail>>(
        `/api/announcements/${input.id}`,
        { headers: authHeader(ctx.accessToken) },
      ),
    ),

  // 作成(常に下書き)(owner/admin)。
  create: authenticatedProcedure
    .input(
      z.object({
        boardId: uuidLike,
        title: z.string().min(1).max(200),
        bodyRich,
        notifyEmail: z.boolean().optional(),
      }),
    )
    .mutation(({ input, ctx }) =>
      callHonoApi<ApiResponse<{ id: string }>>("/api/announcements", {
        method: "POST",
        headers: authHeader(ctx.accessToken),
        body: JSON.stringify(input),
      }),
    ),

  // 編集(owner/admin)。
  update: authenticatedProcedure
    .input(
      z.object({
        id: uuidLike,
        title: z.string().min(1).max(200).optional(),
        bodyRich: bodyRich.optional(),
        notifyEmail: z.boolean().optional(),
      }),
    )
    .mutation(({ input, ctx }) => {
      const { id, ...body } = input;
      return callHonoApi<ApiResponse<never>>(`/api/announcements/${id}`, {
        method: "PATCH",
        headers: authHeader(ctx.accessToken),
        body: JSON.stringify(body),
      });
    }),

  // 公開(owner/admin)。notify_email=true ならメンバー全員へメール送信。
  publish: authenticatedProcedure
    .input(z.object({ id: uuidLike }))
    .mutation(({ input, ctx }) =>
      callHonoApi<ApiResponse<never>>(
        `/api/announcements/${input.id}/publish`,
        {
          method: "POST",
          headers: authHeader(ctx.accessToken),
        },
      ),
    ),

  // 削除(owner/admin)。
  remove: authenticatedProcedure
    .input(z.object({ id: uuidLike }))
    .mutation(({ input, ctx }) =>
      callHonoApi<ApiResponse<never>>(`/api/announcements/${input.id}`, {
        method: "DELETE",
        headers: authHeader(ctx.accessToken),
      }),
    ),

  // 既読(メンバー)。冪等。
  markRead: authenticatedProcedure
    .input(z.object({ id: uuidLike }))
    .mutation(({ input, ctx }) =>
      callHonoApi<ApiResponse<never>>(`/api/announcements/${input.id}/read`, {
        method: "PUT",
        headers: authHeader(ctx.accessToken),
      }),
    ),
});
