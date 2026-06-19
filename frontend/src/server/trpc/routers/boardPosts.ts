// 道場内フィード feature router(ADR 0002 B-6)。tRPC procedure ↔ Hono endpoint は 1:1。
// 一覧・詳細(メンバー)、作成・削除、アップロード URL 発行。

import { z } from "zod";
import type { ApiResponse } from "@/lib/types/api";
import type {
  AikinotePostSummary,
  FeedListResult,
  FeedPost,
  ThreadReply,
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

  // 投稿作成(メンバー)。本文 + 添付(任意) + AikiNote 連携(クロスポスト/引用)。
  create: authenticatedProcedure
    .input(
      z.object({
        boardId: uuidLike,
        body: z.string().max(5000),
        attachments: z.array(attachmentInput).max(4).optional(),
        crossPostToAikinote: z.boolean().optional(),
        syncedFromPostId: uuidLike.optional(),
      }),
    )
    .mutation(({ input, ctx }) =>
      callHonoApi<ApiResponse<{ id: string }>>("/api/board-posts", {
        method: "POST",
        headers: authHeader(ctx.accessToken),
        body: JSON.stringify(input),
      }),
    ),

  // 引用ピッカー用: 自分の AikiNote 投稿一覧(5.3.2)。
  aikinotePosts: authenticatedProcedure
    .input(z.object({ boardId: uuidLike }))
    .query(({ input, ctx }) => {
      const qs = new URLSearchParams({ boardId: input.boardId });
      return callHonoApi<ApiResponse<AikinotePostSummary[]>>(
        `/api/board-posts/aikinote-posts?${qs.toString()}`,
        { headers: authHeader(ctx.accessToken) },
      );
    }),

  // 削除(投稿者本人 or owner/admin)。
  remove: authenticatedProcedure
    .input(z.object({ id: uuidLike }))
    .mutation(({ input, ctx }) =>
      callHonoApi<ApiResponse<never>>(`/api/board-posts/${input.id}`, {
        method: "DELETE",
        headers: authHeader(ctx.accessToken),
      }),
    ),

  // 返信一覧(古い順)。
  listThreads: authenticatedProcedure
    .input(z.object({ postId: uuidLike }))
    .query(({ input, ctx }) =>
      callHonoApi<ApiResponse<ThreadReply[]>>(
        `/api/board-posts/${input.postId}/threads`,
        { headers: authHeader(ctx.accessToken) },
      ),
    ),

  // 返信作成(メンバー)。
  createThread: authenticatedProcedure
    .input(z.object({ postId: uuidLike, body: z.string().min(1).max(5000) }))
    .mutation(({ input, ctx }) =>
      callHonoApi<ApiResponse<{ id: string }>>(
        `/api/board-posts/${input.postId}/threads`,
        {
          method: "POST",
          headers: authHeader(ctx.accessToken),
          body: JSON.stringify({ body: input.body }),
        },
      ),
    ),

  // 返信削除(返信者本人 or owner/admin)。
  removeThread: authenticatedProcedure
    .input(z.object({ postId: uuidLike, threadId: uuidLike }))
    .mutation(({ input, ctx }) =>
      callHonoApi<ApiResponse<never>>(
        `/api/board-posts/${input.postId}/threads/${input.threadId}`,
        {
          method: "DELETE",
          headers: authHeader(ctx.accessToken),
        },
      ),
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
