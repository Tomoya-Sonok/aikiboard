// boards feature router(ADR 0002 B-6)。tRPC procedure ↔ Hono endpoint は 1:1。

import { z } from "zod";
import type { ApiResponse } from "@/lib/types/api";
import type {
  BoardDeletionSummary,
  BoardDetail,
  BoardSummary,
} from "@/lib/types/board";
import { callHonoApi } from "../hono";
import { authenticatedProcedure, createTRPCRouter } from "../index";

const slugRegex = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/;
const uuidLike = z
  .string()
  .regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);

type CreatedBoard = {
  id: string;
  name: string;
  slug: string;
  is_public: boolean;
};

export const boardsRouter = createTRPCRouter({
  // ログイン中ユーザーの所属ボード一覧(ログイン後リゾルバ / サイドバー切替で使う)。
  list: authenticatedProcedure.query(({ ctx }) =>
    callHonoApi<ApiResponse<BoardSummary[]>>("/api/boards", {
      headers: { Authorization: `Bearer ${ctx.accessToken}` },
    }),
  ),

  // slug でボード詳細を取得(メンバー判定込み)。ボードホームのガードと表示に使う。
  getBySlug: authenticatedProcedure
    .input(z.object({ slug: z.string().regex(slugRegex) }))
    .query(({ input, ctx }) =>
      callHonoApi<ApiResponse<BoardDetail>>(`/api/boards/${input.slug}`, {
        headers: { Authorization: `Bearer ${ctx.accessToken}` },
      }),
    ),

  // ボード作成(認証必須、作成者が owner になる)。
  create: authenticatedProcedure
    .input(
      z.object({
        name: z.string().min(1).max(50),
        slug: z.string().min(3).max(63).regex(slugRegex),
        isPublic: z.boolean(),
        description: z.string().max(500).optional(),
        dojoMasterIds: z.array(uuidLike).min(1).max(10),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      return callHonoApi<ApiResponse<CreatedBoard>>("/api/boards", {
        method: "POST",
        headers: { Authorization: `Bearer ${ctx.accessToken}` },
        body: JSON.stringify(input),
      });
    }),

  // 削除前の集計(owner 限定)。確認ダイアログで「何がどれだけ消えるか」を出す。
  deletionSummary: authenticatedProcedure
    .input(z.object({ boardId: uuidLike }))
    .query(({ input, ctx }) =>
      callHonoApi<ApiResponse<BoardDeletionSummary>>(
        `/api/boards/${input.boardId}/deletion-summary`,
        { headers: { Authorization: `Bearer ${ctx.accessToken}` } },
      ),
    ),

  // ボード削除(owner 限定、物理削除)。
  remove: authenticatedProcedure
    .input(z.object({ boardId: uuidLike }))
    .mutation(({ input, ctx }) =>
      callHonoApi<ApiResponse<never>>(`/api/boards/${input.boardId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${ctx.accessToken}` },
      }),
    ),
});
