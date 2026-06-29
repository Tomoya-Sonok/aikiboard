// 道場内フィード feature router(ADR 0002 B-6)。tRPC procedure ↔ Hono endpoint は 1:1。
// 一覧・詳細(メンバー)、作成・削除、アップロード URL 発行。

import { z } from "zod";
import type { ApiResponse } from "@/lib/types/api";
import type {
  FeedListResult,
  FeedPost,
  UploadUrlResult,
} from "@/lib/types/post";
import { callHonoApi } from "../hono";
import { authenticatedProcedure, createTRPCRouter } from "../index";

const uuidLike = z
  .string()
  .regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);

const attachmentInput = z.object({
  path: z.string().min(1).max(500),
  attachmentType: z.enum(["image", "video"]),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

const authHeader = (accessToken: string) => ({
  Authorization: `Bearer ${accessToken}`,
});

export const boardPostsRouter = createTRPCRouter({
  // フィード一覧(新しい順、ページネーション)。
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
      return callHonoApi<ApiResponse<FeedListResult>>(
        `/api/board-posts?${qs.toString()}`,
        { headers: authHeader(ctx.accessToken) },
      );
    }),

  // 投稿 1 件(スレッド画面の先頭表示用)。
  detail: authenticatedProcedure
    .input(z.object({ id: uuidLike }))
    .query(({ input, ctx }) =>
      callHonoApi<ApiResponse<FeedPost>>(`/api/board-posts/${input.id}`, {
        headers: authHeader(ctx.accessToken),
      }),
    ),

  // 投稿作成(メンバー)。本文 + 添付(任意)。
  create: authenticatedProcedure
    .input(
      z.object({
        boardId: uuidLike,
        body: z.string().max(5000),
        attachments: z.array(attachmentInput).max(4).optional(),
      }),
    )
    .mutation(({ input, ctx }) =>
      callHonoApi<ApiResponse<{ id: string }>>("/api/board-posts", {
        method: "POST",
        headers: authHeader(ctx.accessToken),
        body: JSON.stringify(input),
      }),
    ),

  // 削除(投稿者本人 or owner/admin)。
  remove: authenticatedProcedure
    .input(z.object({ id: uuidLike }))
    .mutation(({ input, ctx }) =>
      callHonoApi<ApiResponse<never>>(`/api/board-posts/${input.id}`, {
        method: "DELETE",
        headers: authHeader(ctx.accessToken),
      }),
    ),

  // 署名付きアップロード URL の発行(メンバー)。
  createUploadUrl: authenticatedProcedure
    .input(
      z.object({
        boardId: uuidLike,
        contentType: z.string().min(1).max(100),
      }),
    )
    .mutation(({ input, ctx }) =>
      callHonoApi<ApiResponse<UploadUrlResult>>("/api/board-posts/upload-url", {
        method: "POST",
        headers: authHeader(ctx.accessToken),
        body: JSON.stringify(input),
      }),
    ),
});
