// events feature router(ADR 0002 B-6)。tRPC procedure ↔ Hono endpoint は 1:1。
// PR-B(カレンダー UI)では一覧・作成・編集・削除・休講・上書きを扱う。
// 出欠表明(setRsvp / clearRsvp)は PR-C で追加する。

import { z } from "zod";
import type { ApiResponse } from "@/lib/types/api";
import type { EventOccurrence } from "@/lib/types/event";
import { callHonoApi } from "../hono";
import { authenticatedProcedure, createTRPCRouter } from "../index";

const uuidLike = z
  .string()
  .regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
const isoString = z
  .string()
  .refine((s) => !Number.isNaN(Date.parse(s)), "日時の形式が正しくありません");
const weekday = z.enum(["MO", "TU", "WE", "TH", "FR", "SA", "SU"]);

const recurrenceInput = z.object({
  freq: z.enum(["DAILY", "WEEKLY", "MONTHLY"]),
  interval: z.number().int().min(1).max(99).optional(),
  byweekday: z.array(weekday).min(1).max(7).optional(),
  bymonthday: z.number().int().min(1).max(31).optional(),
  until: isoString.optional(),
  count: z.number().int().min(1).max(366).optional(),
});

const authHeader = (accessToken: string) => ({
  Authorization: `Bearer ${accessToken}`,
});

export const eventsRouter = createTRPCRouter({
  // 月範囲のオカレンス一覧(展開 + 出欠集計 + 自分の出欠)。
  list: authenticatedProcedure
    .input(z.object({ boardId: uuidLike, from: isoString, to: isoString }))
    .query(({ input, ctx }) => {
      const qs = new URLSearchParams({
        boardId: input.boardId,
        from: input.from,
        to: input.to,
      });
      return callHonoApi<ApiResponse<EventOccurrence[]>>(
        `/api/events?${qs.toString()}`,
        { headers: authHeader(ctx.accessToken) },
      );
    }),

  // 稽古(シリーズ)作成(owner/admin)。
  create: authenticatedProcedure
    .input(
      z.object({
        boardId: uuidLike,
        startAt: isoString,
        endAt: isoString,
        place: z.string().min(1).max(200),
        instructorName: z.string().max(100).optional(),
        note: z.string().max(2000).optional(),
        isPublic: z.boolean().optional(),
        recurrence: recurrenceInput.nullish(),
      }),
    )
    .mutation(({ input, ctx }) =>
      callHonoApi<ApiResponse<{ id: string }>>("/api/events", {
        method: "POST",
        headers: authHeader(ctx.accessToken),
        body: JSON.stringify(input),
      }),
    ),

  // シリーズ全体の編集(owner/admin)。
  update: authenticatedProcedure
    .input(
      z.object({
        eventId: uuidLike,
        startAt: isoString.optional(),
        endAt: isoString.optional(),
        place: z.string().min(1).max(200).optional(),
        instructorName: z.string().max(100).nullable().optional(),
        note: z.string().max(2000).nullable().optional(),
        isPublic: z.boolean().optional(),
        recurrence: recurrenceInput.nullable().optional(),
      }),
    )
    .mutation(({ input, ctx }) => {
      const { eventId, ...body } = input;
      return callHonoApi<ApiResponse<never>>(`/api/events/${eventId}`, {
        method: "PATCH",
        headers: authHeader(ctx.accessToken),
        body: JSON.stringify(body),
      });
    }),

  // シリーズ全体の削除(owner/admin)。
  remove: authenticatedProcedure
    .input(z.object({ eventId: uuidLike }))
    .mutation(({ input, ctx }) =>
      callHonoApi<ApiResponse<never>>(`/api/events/${input.eventId}`, {
        method: "DELETE",
        headers: authHeader(ctx.accessToken),
      }),
    ),

  // この回だけ休講(owner/admin)。
  cancelOccurrence: authenticatedProcedure
    .input(z.object({ eventId: uuidLike, occurrenceStart: isoString }))
    .mutation(({ input, ctx }) =>
      callHonoApi<ApiResponse<never>>(
        `/api/events/${input.eventId}/occurrences/cancel`,
        {
          method: "POST",
          headers: authHeader(ctx.accessToken),
          body: JSON.stringify({ occurrenceStart: input.occurrenceStart }),
        },
      ),
    ),

  // この回だけ時刻・場所などを上書き(owner/admin)。
  overrideOccurrence: authenticatedProcedure
    .input(
      z.object({
        eventId: uuidLike,
        occurrenceStart: isoString,
        startAt: isoString.nullable().optional(),
        endAt: isoString.nullable().optional(),
        place: z.string().max(200).nullable().optional(),
        instructorName: z.string().max(100).nullable().optional(),
        note: z.string().max(2000).nullable().optional(),
      }),
    )
    .mutation(({ input, ctx }) => {
      const { eventId, ...body } = input;
      return callHonoApi<ApiResponse<never>>(
        `/api/events/${eventId}/occurrences/override`,
        {
          method: "POST",
          headers: authHeader(ctx.accessToken),
          body: JSON.stringify(body),
        },
      );
    }),
});
