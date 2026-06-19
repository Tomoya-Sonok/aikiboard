// ボード Todo feature router(ADR 0002 B-6)。owner/admin のみ。

import { z } from "zod";
import type { ApiResponse } from "@/lib/types/api";
import type { BoardTodo, TodoAssigneeOption } from "@/lib/types/todo";
import { callHonoApi } from "../hono";
import { authenticatedProcedure, createTRPCRouter } from "../index";

const uuidLike = z
  .string()
  .regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
const statusEnum = z.enum(["todo", "in_progress", "done"]);
const dueDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .nullable()
  .optional();

const h = (accessToken: string) => ({ Authorization: `Bearer ${accessToken}` });

export const boardTodosRouter = createTRPCRouter({
  list: authenticatedProcedure
    .input(z.object({ boardId: uuidLike }))
    .query(({ input, ctx }) =>
      callHonoApi<ApiResponse<BoardTodo[]>>(
        `/api/board-todos?boardId=${input.boardId}`,
        { headers: h(ctx.accessToken) },
      ),
    ),

  assignees: authenticatedProcedure
    .input(z.object({ boardId: uuidLike }))
    .query(({ input, ctx }) =>
      callHonoApi<ApiResponse<TodoAssigneeOption[]>>(
        `/api/board-todos/assignees?boardId=${input.boardId}`,
        { headers: h(ctx.accessToken) },
      ),
    ),

  create: authenticatedProcedure
    .input(
      z.object({
        boardId: uuidLike,
        title: z.string().min(1).max(20),
        assigneeUserId: uuidLike,
        note: z.string().max(300).optional(),
        status: statusEnum.optional(),
        dueDate,
      }),
    )
    .mutation(({ input, ctx }) =>
      callHonoApi<ApiResponse<{ id: string }>>("/api/board-todos", {
        method: "POST",
        headers: h(ctx.accessToken),
        body: JSON.stringify(input),
      }),
    ),

  update: authenticatedProcedure
    .input(
      z.object({
        id: uuidLike,
        title: z.string().min(1).max(20).optional(),
        assigneeUserId: uuidLike.optional(),
        note: z.string().max(300).nullable().optional(),
        status: statusEnum.optional(),
        dueDate,
      }),
    )
    .mutation(({ input, ctx }) => {
      const { id, ...body } = input;
      return callHonoApi<ApiResponse<never>>(`/api/board-todos/${id}`, {
        method: "PATCH",
        headers: h(ctx.accessToken),
        body: JSON.stringify(body),
      });
    }),

  remove: authenticatedProcedure
    .input(z.object({ id: uuidLike }))
    .mutation(({ input, ctx }) =>
      callHonoApi<ApiResponse<never>>(`/api/board-todos/${input.id}`, {
        method: "DELETE",
        headers: h(ctx.accessToken),
      }),
    ),
});
