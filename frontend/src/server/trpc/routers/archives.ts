// アーカイブ feature router(ADR 0002 B-6)。有料機能 + 階層ページ。

import { z } from "zod";
import type { ApiResponse } from "@/lib/types/api";
import type {
  ArchiveDetail,
  ArchiveSearchResult,
  ArchiveTreeNode,
  ArchiveUploadUrl,
} from "@/lib/types/archive";
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

export const archivesRouter = createTRPCRouter({
  list: authenticatedProcedure
    .input(z.object({ boardId: uuidLike }))
    .query(({ input, ctx }) => {
      const qs = new URLSearchParams({ boardId: input.boardId });
      return callHonoApi<ApiResponse<ArchiveTreeNode[]>>(
        `/api/archives?${qs.toString()}`,
        { headers: authHeader(ctx.accessToken) },
      );
    }),

  detail: authenticatedProcedure
    .input(z.object({ id: uuidLike }))
    .query(({ input, ctx }) =>
      callHonoApi<ApiResponse<ArchiveDetail>>(`/api/archives/${input.id}`, {
        headers: authHeader(ctx.accessToken),
      }),
    ),

  search: authenticatedProcedure
    .input(z.object({ boardId: uuidLike, q: z.string().max(100) }))
    .query(({ input, ctx }) => {
      const qs = new URLSearchParams({ boardId: input.boardId, q: input.q });
      return callHonoApi<ApiResponse<ArchiveSearchResult[]>>(
        `/api/archives/search?${qs.toString()}`,
        { headers: authHeader(ctx.accessToken) },
      );
    }),

  create: authenticatedProcedure
    .input(
      z.object({
        boardId: uuidLike,
        parentId: uuidLike.nullable().optional(),
        title: z.string().min(1).max(200),
        bodyRich: z.unknown(),
        attachments: z.array(attachmentInput).max(12).optional(),
      }),
    )
    .mutation(({ input, ctx }) =>
      callHonoApi<ApiResponse<{ id: string }>>("/api/archives", {
        method: "POST",
        headers: authHeader(ctx.accessToken),
        body: JSON.stringify(input),
      }),
    ),

  update: authenticatedProcedure
    .input(
      z.object({
        id: uuidLike,
        title: z.string().min(1).max(200).optional(),
        bodyRich: z.unknown().optional(),
        parentId: uuidLike.nullable().optional(),
        orderIndex: z.number().int().min(0).optional(),
        attachments: z.array(attachmentInput).max(12).optional(),
      }),
    )
    .mutation(({ input, ctx }) => {
      const { id, ...body } = input;
      return callHonoApi<ApiResponse<never>>(`/api/archives/${id}`, {
        method: "PATCH",
        headers: authHeader(ctx.accessToken),
        body: JSON.stringify(body),
      });
    }),

  remove: authenticatedProcedure
    .input(z.object({ id: uuidLike }))
    .mutation(({ input, ctx }) =>
      callHonoApi<ApiResponse<never>>(`/api/archives/${input.id}`, {
        method: "DELETE",
        headers: authHeader(ctx.accessToken),
      }),
    ),

  createUploadUrl: authenticatedProcedure
    .input(z.object({ boardId: uuidLike, contentType: z.string().max(100) }))
    .mutation(({ input, ctx }) =>
      callHonoApi<ApiResponse<ArchiveUploadUrl>>("/api/archives/upload-url", {
        method: "POST",
        headers: authHeader(ctx.accessToken),
        body: JSON.stringify(input),
      }),
    ),
});
