// 会計 feature router(ADR 0002 B-6)。owner/admin + 有料機能 accounting。

import { z } from "zod";
import type { ApiResponse } from "@/lib/types/api";
import type {
  Expense,
  FeeMember,
  FinanceSummary,
  PaymentMember,
} from "@/lib/types/finance";
import { callHonoApi } from "../hono";
import { authenticatedProcedure, createTRPCRouter } from "../index";

const uuidLike = z
  .string()
  .regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);

const h = (accessToken: string) => ({ Authorization: `Bearer ${accessToken}` });

export const financeRouter = createTRPCRouter({
  fees: authenticatedProcedure
    .input(z.object({ boardId: uuidLike }))
    .query(({ input, ctx }) =>
      callHonoApi<ApiResponse<FeeMember[]>>(
        `/api/finance/fees?boardId=${input.boardId}`,
        { headers: h(ctx.accessToken) },
      ),
    ),

  setFee: authenticatedProcedure
    .input(
      z.object({
        boardId: uuidLike,
        userId: uuidLike,
        monthlyFee: z.number().int().min(0),
      }),
    )
    .mutation(({ input, ctx }) =>
      callHonoApi<ApiResponse<never>>("/api/finance/fees", {
        method: "PUT",
        headers: h(ctx.accessToken),
        body: JSON.stringify(input),
      }),
    ),

  payments: authenticatedProcedure
    .input(z.object({ boardId: uuidLike, period: z.string().regex(/^\d{6}$/) }))
    .query(({ input, ctx }) => {
      const qs = new URLSearchParams({
        boardId: input.boardId,
        period: input.period,
      });
      return callHonoApi<ApiResponse<PaymentMember[]>>(
        `/api/finance/payments?${qs.toString()}`,
        { headers: h(ctx.accessToken) },
      );
    }),

  setPayment: authenticatedProcedure
    .input(
      z.object({
        boardId: uuidLike,
        userId: uuidLike,
        period: z.string().regex(/^\d{6}$/),
        status: z.enum(["paid", "unpaid", "waived"]),
      }),
    )
    .mutation(({ input, ctx }) =>
      callHonoApi<ApiResponse<never>>("/api/finance/payments", {
        method: "PUT",
        headers: h(ctx.accessToken),
        body: JSON.stringify(input),
      }),
    ),

  expenses: authenticatedProcedure
    .input(z.object({ boardId: uuidLike, year: z.number().int() }))
    .query(({ input, ctx }) => {
      const qs = new URLSearchParams({
        boardId: input.boardId,
        year: String(input.year),
      });
      return callHonoApi<ApiResponse<Expense[]>>(
        `/api/finance/expenses?${qs.toString()}`,
        { headers: h(ctx.accessToken) },
      );
    }),

  addExpense: authenticatedProcedure
    .input(
      z.object({
        boardId: uuidLike,
        date: z.string(),
        category: z.string().min(1).max(50),
        amount: z.number().int().min(0),
        note: z.string().max(500).optional(),
      }),
    )
    .mutation(({ input, ctx }) =>
      callHonoApi<ApiResponse<{ id: string }>>("/api/finance/expenses", {
        method: "POST",
        headers: h(ctx.accessToken),
        body: JSON.stringify(input),
      }),
    ),

  removeExpense: authenticatedProcedure
    .input(z.object({ id: uuidLike }))
    .mutation(({ input, ctx }) =>
      callHonoApi<ApiResponse<never>>(`/api/finance/expenses/${input.id}`, {
        method: "DELETE",
        headers: h(ctx.accessToken),
      }),
    ),

  summary: authenticatedProcedure
    .input(z.object({ boardId: uuidLike, year: z.number().int() }))
    .query(({ input, ctx }) => {
      const qs = new URLSearchParams({
        boardId: input.boardId,
        year: String(input.year),
      });
      return callHonoApi<ApiResponse<FinanceSummary>>(
        `/api/finance/summary?${qs.toString()}`,
        { headers: h(ctx.accessToken) },
      );
    }),
});
