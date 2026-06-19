// 稽古カレンダー(イベント)+ 出欠 API。
//
// 認証は authMiddleware、ボード権限は boardAccess ミドルウェアで確認する。
//   - 読み取り(一覧)        : boardMemberMiddleware(メンバー以上)
//   - 書き込み(作成/編集/削除/例外/出欠集計): boardAdminMiddleware(owner/admin)
//   - 出欠表明(自分の参加/不参加): boardMemberMiddleware(自分の行のみ)
//
// 定期稽古は events を「シリーズ 1 行」で保持し、recurrence_rule を backend で月範囲に
// 展開する(lib/recurrence.ts)。出欠・例外は「開催日(occurrence_start アンカー)」単位。
//
// 認可について(重要): backend は service_role で動くため RLS を完全にバイパスする。
// したがってこの経路の認可は boardAccess ミドルウェアが唯一の砦であり、RLS は
// 二重防御にはならない(RLS が効くのは frontend が anon キーで直接アクセスする経路)。
// この前提でミドルウェアと入力検証(occurrence アンカー検証含む)を厚くしている。

import type { SupabaseClient } from "@supabase/supabase-js";
import { type Context, Hono } from "hono";
import { z } from "zod";
import type { AppBindings, AppVariables } from "../../app.js";
import { logger } from "../../lib/logger.js";
import { notifyBoardMembers } from "../../lib/notifications.js";
import {
  applyOverrides,
  expandEvent,
  type OccurrenceOverride,
  serializeRule,
} from "../../lib/recurrence.js";
import { authMiddleware } from "../../middleware/auth.js";
import {
  boardAdminMiddleware,
  boardMemberMiddleware,
} from "../../middleware/boardAccess.js";

type EventsEnv = { Bindings: AppBindings; Variables: AppVariables };

const eventsRoute = new Hono<EventsEnv>();

const uuidLike = z
  .string()
  .regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);

const isoString = z
  .string()
  .refine((s) => !Number.isNaN(Date.parse(s)), "日時の形式が正しくありません");

const weekday = z.enum(["MO", "TU", "WE", "TH", "FR", "SA", "SU"]);

const recurrenceSchema = z.object({
  freq: z.enum(["DAILY", "WEEKLY", "MONTHLY"]),
  interval: z.number().int().min(1).max(99).optional(),
  byweekday: z.array(weekday).min(1).max(7).optional(),
  bymonthday: z.number().int().min(1).max(31).optional(),
  until: isoString.optional(),
  count: z.number().int().min(1).max(366).optional(),
});

type RecurrenceInput = z.infer<typeof recurrenceSchema>;

// recurrence 入力 → events.recurrence_rule(RFC5545 文字列)。
const toRuleText = (r: RecurrenceInput): string =>
  serializeRule({
    freq: r.freq,
    interval: r.interval ?? 1,
    byweekday: r.byweekday,
    bymonthday: r.bymonthday,
    until: r.until,
    count: r.count,
  });

const createEventSchema = z
  .object({
    boardId: uuidLike,
    startAt: isoString,
    endAt: isoString,
    place: z.string().min(1).max(200),
    instructorName: z.string().max(100).optional(),
    note: z.string().max(2000).optional(),
    isPublic: z.boolean().optional(),
    recurrence: recurrenceSchema.nullish(),
  })
  .refine((v) => Date.parse(v.startAt) < Date.parse(v.endAt), {
    message: "開始は終了より前である必要があります",
  });

const updateEventSchema = z.object({
  startAt: isoString.optional(),
  endAt: isoString.optional(),
  place: z.string().min(1).max(200).optional(),
  instructorName: z.string().max(100).nullable().optional(),
  note: z.string().max(2000).nullable().optional(),
  isPublic: z.boolean().optional(),
  recurrence: recurrenceSchema.nullable().optional(),
});

const cancelSchema = z.object({ occurrenceStart: isoString });

const overrideSchema = z.object({
  occurrenceStart: isoString,
  startAt: isoString.nullable().optional(),
  endAt: isoString.nullable().optional(),
  place: z.string().max(200).nullable().optional(),
  instructorName: z.string().max(100).nullable().optional(),
  note: z.string().max(2000).nullable().optional(),
});

const rsvpSchema = z.object({
  occurrenceStart: isoString,
  status: z.enum(["attend", "decline"]),
});

const rsvpDeleteSchema = z.object({ occurrenceStart: isoString });

// 一覧の窓の最大日数(暴走防止)。カレンダーは月表示なので 6 週 + 余裕で十分。
const MAX_WINDOW_DAYS = 100;

const parseJson = async (
  c: Context<EventsEnv>,
): Promise<unknown | undefined> => {
  try {
    return await c.req.json();
  } catch {
    return undefined;
  }
};

// occurrenceStart が当該イベントの recurrence_rule から実際に展開される正規アンカーかを
// 検証する。アンカー駆動設計の要 — 任意の occurrence_start で出欠/例外のゴミ行を量産させない。
type AnchorCheck = "valid" | "invalid" | "notfound" | "error";

const checkOccurrenceAnchor = async (
  supabase: SupabaseClient,
  eventId: string,
  occurrenceStartIso: string,
): Promise<AnchorCheck> => {
  const { data: ev, error } = await supabase
    .schema("aikiboard")
    .from("events")
    .select("start_at, end_at, recurrence_rule")
    .eq("id", eventId)
    .maybeSingle();
  if (error) {
    return "error";
  }
  if (!ev) {
    return "notfound";
  }
  const targetMs = Date.parse(occurrenceStartIso);
  if (Number.isNaN(targetMs)) {
    return "invalid";
  }
  // 1ms 窓で展開し、ちょうど target に一致するアンカーが生成されるか確認する。
  const occ = expandEvent(
    {
      startAt: ev.start_at,
      endAt: ev.end_at,
      recurrenceRule: ev.recurrence_rule,
    },
    new Date(targetMs).toISOString(),
    new Date(targetMs + 1).toISOString(),
  );
  return occ.some((o) => Date.parse(o.occurrenceStart) === targetMs)
    ? "valid"
    : "invalid";
};

// アンカー検証の結果をそのまま HTTP 応答に変換する(valid のときだけ null を返す)。
const anchorErrorResponse = (c: Context<EventsEnv>, check: AnchorCheck) => {
  if (check === "error") {
    return c.json({ success: false, error: "更新に失敗しました" }, 500);
  }
  if (check === "notfound") {
    return c.json({ success: false, error: "対象が見つかりません" }, 404);
  }
  if (check === "invalid") {
    return c.json(
      { success: false, error: "指定された開催日が見つかりません" },
      400,
    );
  }
  return null;
};

type EventRow = {
  id: string;
  start_at: string;
  end_at: string;
  place: string;
  instructor_name: string | null;
  note: string | null;
  recurrence_rule: string | null;
  is_public: boolean;
};

type OccurrenceDto = {
  eventId: string;
  occurrenceStart: string;
  startAt: string;
  endAt: string;
  place: string;
  instructorName: string | null;
  note: string | null;
  isPublic: boolean;
  isRecurring: boolean;
  isOverridden: boolean;
  recurrenceRule: string | null;
  attendingCount: number;
  decliningCount: number;
  myStatus: "attend" | "decline" | null;
  canManage: boolean;
};

// events を [fromMs, toMs) に展開し、例外・出欠を突合して開催日順のオカレンス DTO を返す。
// 一覧(GET /)と「次の稽古」(GET /next)で共用する。DB エラー時は null。
const loadOccurrences = async (
  supabase: SupabaseClient,
  events: EventRow[],
  fromMs: number,
  toMs: number,
  userId: string | undefined,
  canManage: boolean,
): Promise<OccurrenceDto[] | null> => {
  const aikiboard = supabase.schema("aikiboard");
  const eventIds = events.map((e) => e.id);
  const fromIso = new Date(fromMs).toISOString();
  const toIso = new Date(toMs).toISOString();

  const [overridesRes, rsvpsRes] = await Promise.all([
    aikiboard
      .from("event_overrides")
      .select(
        "event_id, occurrence_start, is_cancelled, override_start_at, override_end_at, place, instructor_name, note",
      )
      .in("event_id", eventIds),
    aikiboard
      .from("event_rsvps")
      .select("event_id, occurrence_start, user_id, status")
      .in("event_id", eventIds)
      .gte("occurrence_start", fromIso)
      .lt("occurrence_start", toIso),
  ]);
  if (overridesRes.error || rsvpsRes.error) {
    return null;
  }

  const overridesByEvent = new Map<string, OccurrenceOverride[]>();
  for (const o of overridesRes.data ?? []) {
    const list = overridesByEvent.get(o.event_id) ?? [];
    list.push({
      occurrenceStart: o.occurrence_start,
      isCancelled: o.is_cancelled,
      overrideStartAt: o.override_start_at,
      overrideEndAt: o.override_end_at,
      place: o.place,
      instructorName: o.instructor_name,
      note: o.note,
    });
    overridesByEvent.set(o.event_id, list);
  }

  const attendByKey = new Map<string, number>();
  const declineByKey = new Map<string, number>();
  const myStatusByKey = new Map<string, "attend" | "decline">();
  const keyOf = (eventId: string, anchorIso: string) =>
    `${eventId}|${Date.parse(anchorIso)}`;
  for (const r of rsvpsRes.data ?? []) {
    const key = keyOf(r.event_id, r.occurrence_start);
    if (r.status === "attend") {
      attendByKey.set(key, (attendByKey.get(key) ?? 0) + 1);
    } else {
      declineByKey.set(key, (declineByKey.get(key) ?? 0) + 1);
    }
    if (userId && r.user_id === userId) {
      myStatusByKey.set(key, r.status);
    }
  }

  const occurrences: OccurrenceDto[] = [];
  for (const event of events) {
    const raw = expandEvent(
      {
        startAt: event.start_at,
        endAt: event.end_at,
        recurrenceRule: event.recurrence_rule,
      },
      fromIso,
      toIso,
    );
    const effective = applyOverrides(raw, overridesByEvent.get(event.id) ?? []);
    for (const occ of effective) {
      const ov = occ.override;
      const key = keyOf(event.id, occ.occurrenceStart);
      occurrences.push({
        eventId: event.id,
        occurrenceStart: occ.occurrenceStart,
        startAt: occ.startAt,
        endAt: occ.endAt,
        place: ov?.place ?? event.place,
        instructorName: ov?.instructorName ?? event.instructor_name,
        note: ov?.note ?? event.note,
        isPublic: event.is_public,
        isRecurring: event.recurrence_rule != null,
        isOverridden: occ.isOverridden,
        recurrenceRule: event.recurrence_rule,
        attendingCount: attendByKey.get(key) ?? 0,
        decliningCount: declineByKey.get(key) ?? 0,
        myStatus: myStatusByKey.get(key) ?? null,
        canManage,
      });
    }
  }

  occurrences.sort((a, b) => Date.parse(a.startAt) - Date.parse(b.startAt));
  return occurrences;
};

// 「次の稽古」を探す展開ホライズン(日)。
const NEXT_HORIZON_DAYS = 180;
// 過去側の余白(日)。admin が過去回をこの範囲で未来へ振替(override)しても拾えるよう、
// 展開窓の下限を now より過去に広げ、最終的に startAt >= now でフィルタする。
const NEXT_PAST_HORIZON_DAYS = 60;

// ────────────────────────────────────────────────────────────────
// GET /api/events?boardId=&from=&to= — 月範囲のオカレンス一覧(メンバー)
// ────────────────────────────────────────────────────────────────
eventsRoute.get("/", authMiddleware, boardMemberMiddleware, async (c) => {
  const supabase = c.get("supabase");
  if (!supabase) {
    return c.json({ success: false, error: "サーバー設定が不正です" }, 500);
  }
  const userId = c.get("userId");
  const boardId = c.get("boardId");
  const boardRole = c.get("boardRole");
  const canManage = boardRole === "owner" || boardRole === "admin";
  const aikiboard = supabase.schema("aikiboard");

  const fromIso = c.req.query("from");
  const toIso = c.req.query("to");
  if (!fromIso || !toIso) {
    return c.json({ success: false, error: "期間の指定が必要です" }, 400);
  }
  const fromMs = Date.parse(fromIso);
  const toMs = Date.parse(toIso);
  if (Number.isNaN(fromMs) || Number.isNaN(toMs) || fromMs >= toMs) {
    return c.json({ success: false, error: "期間の指定が不正です" }, 400);
  }
  if (toMs - fromMs > MAX_WINDOW_DAYS * 24 * 60 * 60 * 1000) {
    return c.json({ success: false, error: "期間が長すぎます" }, 400);
  }

  const failWith = (logMessage: string) => {
    logger.error(logMessage, { feature: "events", boardId, userId });
    return c.json({ success: false, error: "稽古の取得に失敗しました" }, 500);
  };

  const { data: events, error: eventsError } = await aikiboard
    .from("events")
    .select(
      "id, start_at, end_at, place, instructor_name, note, recurrence_rule, is_public",
    )
    .eq("board_id", boardId);
  if (eventsError) {
    return failWith("events の取得に失敗");
  }
  if (!events || events.length === 0) {
    return c.json({ success: true, data: [] });
  }

  const occurrences = await loadOccurrences(
    supabase,
    events,
    fromMs,
    toMs,
    userId,
    canManage,
  );
  if (!occurrences) {
    return failWith("稽古の関連データ取得に失敗");
  }

  return c.json({ success: true, data: occurrences });
});

// ────────────────────────────────────────────────────────────────
// GET /api/events/next?boardId= — 今以降の最も近い稽古 1 件(ダッシュボード用)
// ────────────────────────────────────────────────────────────────
eventsRoute.get("/next", authMiddleware, boardMemberMiddleware, async (c) => {
  const supabase = c.get("supabase");
  if (!supabase) {
    return c.json({ success: false, error: "サーバー設定が不正です" }, 500);
  }
  const userId = c.get("userId");
  const boardId = c.get("boardId");
  const boardRole = c.get("boardRole");
  const canManage = boardRole === "owner" || boardRole === "admin";
  const aikiboard = supabase.schema("aikiboard");

  const nowMs = Date.now();
  const dayMs = 24 * 60 * 60 * 1000;
  const fromMs = nowMs - NEXT_PAST_HORIZON_DAYS * dayMs;
  const toMs = nowMs + NEXT_HORIZON_DAYS * dayMs;

  const failWith = (logMessage: string) => {
    logger.error(logMessage, { feature: "events", boardId, userId });
    return c.json({ success: false, error: "稽古の取得に失敗しました" }, 500);
  };

  const { data: events, error: eventsError } = await aikiboard
    .from("events")
    .select(
      "id, start_at, end_at, place, instructor_name, note, recurrence_rule, is_public",
    )
    .eq("board_id", boardId);
  if (eventsError) {
    return failWith("events の取得に失敗");
  }
  if (!events || events.length === 0) {
    return c.json({ success: true, data: null });
  }

  const occurrences = await loadOccurrences(
    supabase,
    events,
    fromMs,
    toMs,
    userId,
    canManage,
  );
  if (!occurrences) {
    return failWith("稽古の関連データ取得に失敗");
  }

  // 開催日順なので、(上書き後の)開始時刻が今以降で最初のものが「次の稽古」。
  const next = occurrences.find((o) => Date.parse(o.startAt) >= nowMs) ?? null;
  return c.json({ success: true, data: next });
});

// ────────────────────────────────────────────────────────────────
// POST /api/events — 稽古(シリーズ)作成(owner/admin)
// ────────────────────────────────────────────────────────────────
eventsRoute.post("/", authMiddleware, boardAdminMiddleware, async (c) => {
  const supabase = c.get("supabase");
  if (!supabase) {
    return c.json({ success: false, error: "サーバー設定が不正です" }, 500);
  }
  const userId = c.get("userId");
  const boardId = c.get("boardId");

  const body = await parseJson(c);
  const parsed = createEventSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ success: false, error: "入力内容に誤りがあります" }, 400);
  }
  const { startAt, endAt, place, instructorName, note, isPublic, recurrence } =
    parsed.data;

  const { data: event, error } = await supabase
    .schema("aikiboard")
    .from("events")
    .insert({
      board_id: boardId,
      start_at: startAt,
      end_at: endAt,
      place,
      instructor_name: instructorName ?? null,
      note: note ?? null,
      recurrence_rule: recurrence ? toRuleText(recurrence) : null,
      is_public: isPublic ?? true,
      created_by_user_id: userId,
    })
    .select("id")
    .single();
  if (error || !event) {
    logger.error("events の作成に失敗", { feature: "events", boardId, userId });
    return c.json({ success: false, error: "稽古の作成に失敗しました" }, 500);
  }

  logger.info("稽古を作成した", {
    feature: "events",
    boardId,
    eventId: event.id,
  });

  // 稽古の追加をボードメンバー(作成者除く)に通知する。
  if (boardId) {
    await notifyBoardMembers(supabase, {
      boardId,
      actorUserId: userId as string,
      type: "event.created",
      targetType: "event",
      targetId: event.id,
      title: place,
    });
  }

  return c.json({
    success: true,
    data: { id: event.id },
    message: "稽古を作成しました",
  });
});

// ────────────────────────────────────────────────────────────────
// PATCH /api/events/:id — シリーズ全体の編集(owner/admin)
// ────────────────────────────────────────────────────────────────
eventsRoute.patch("/:id", authMiddleware, boardAdminMiddleware, async (c) => {
  const supabase = c.get("supabase");
  if (!supabase) {
    return c.json({ success: false, error: "サーバー設定が不正です" }, 500);
  }
  const eventId = c.req.param("id");

  const body = await parseJson(c);
  const parsed = updateEventSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ success: false, error: "入力内容に誤りがあります" }, 400);
  }
  const p = parsed.data;

  // start/end の前後関係は、両方が確定する場合のみここで検証する。
  if (p.startAt && p.endAt && Date.parse(p.startAt) >= Date.parse(p.endAt)) {
    return c.json({ success: false, error: "入力内容に誤りがあります" }, 400);
  }

  const update: Record<string, unknown> = {};
  if (p.startAt !== undefined) update.start_at = p.startAt;
  if (p.endAt !== undefined) update.end_at = p.endAt;
  if (p.place !== undefined) update.place = p.place;
  if (p.instructorName !== undefined) update.instructor_name = p.instructorName;
  if (p.note !== undefined) update.note = p.note;
  if (p.isPublic !== undefined) update.is_public = p.isPublic;
  if (p.recurrence !== undefined) {
    update.recurrence_rule = p.recurrence ? toRuleText(p.recurrence) : null;
  }

  if (Object.keys(update).length === 0) {
    return c.json({ success: false, error: "変更内容がありません" }, 400);
  }

  const { error } = await supabase
    .schema("aikiboard")
    .from("events")
    .update(update)
    .eq("id", eventId);
  if (error) {
    logger.error("events の更新に失敗", { feature: "events", eventId });
    return c.json({ success: false, error: "稽古の更新に失敗しました" }, 500);
  }

  return c.json({ success: true, message: "稽古を更新しました" });
});

// ────────────────────────────────────────────────────────────────
// DELETE /api/events/:id — シリーズ全体の削除(owner/admin)
// ────────────────────────────────────────────────────────────────
eventsRoute.delete("/:id", authMiddleware, boardAdminMiddleware, async (c) => {
  const supabase = c.get("supabase");
  if (!supabase) {
    return c.json({ success: false, error: "サーバー設定が不正です" }, 500);
  }
  const eventId = c.req.param("id");

  const { error } = await supabase
    .schema("aikiboard")
    .from("events")
    .delete()
    .eq("id", eventId);
  if (error) {
    logger.error("events の削除に失敗", { feature: "events", eventId });
    return c.json({ success: false, error: "稽古の削除に失敗しました" }, 500);
  }

  return c.json({ success: true, message: "稽古を削除しました" });
});

// ────────────────────────────────────────────────────────────────
// POST /api/events/:id/occurrences/cancel — この回だけ休講(owner/admin)
// ────────────────────────────────────────────────────────────────
eventsRoute.post(
  "/:id/occurrences/cancel",
  authMiddleware,
  boardAdminMiddleware,
  async (c) => {
    const supabase = c.get("supabase");
    if (!supabase) {
      return c.json({ success: false, error: "サーバー設定が不正です" }, 500);
    }
    const eventId = c.req.param("id");

    const body = await parseJson(c);
    const parsed = cancelSchema.safeParse(body);
    if (!parsed.success) {
      return c.json({ success: false, error: "入力内容に誤りがあります" }, 400);
    }

    const anchor = await checkOccurrenceAnchor(
      supabase,
      eventId,
      parsed.data.occurrenceStart,
    );
    const anchorErr = anchorErrorResponse(c, anchor);
    if (anchorErr) {
      return anchorErr;
    }

    const { error } = await supabase
      .schema("aikiboard")
      .from("event_overrides")
      .upsert(
        {
          event_id: eventId,
          occurrence_start: parsed.data.occurrenceStart,
          is_cancelled: true,
        },
        { onConflict: "event_id,occurrence_start" },
      );
    if (error) {
      logger.error("オカレンス休講の保存に失敗", {
        feature: "events",
        eventId,
      });
      return c.json({ success: false, error: "更新に失敗しました" }, 500);
    }

    return c.json({ success: true, message: "この回を休講にしました" });
  },
);

// ────────────────────────────────────────────────────────────────
// POST /api/events/:id/occurrences/override — この回だけ上書き(owner/admin)
// ────────────────────────────────────────────────────────────────
eventsRoute.post(
  "/:id/occurrences/override",
  authMiddleware,
  boardAdminMiddleware,
  async (c) => {
    const supabase = c.get("supabase");
    if (!supabase) {
      return c.json({ success: false, error: "サーバー設定が不正です" }, 500);
    }
    const eventId = c.req.param("id");

    const body = await parseJson(c);
    const parsed = overrideSchema.safeParse(body);
    if (!parsed.success) {
      return c.json({ success: false, error: "入力内容に誤りがあります" }, 400);
    }
    const p = parsed.data;
    if (p.startAt && p.endAt && Date.parse(p.startAt) >= Date.parse(p.endAt)) {
      return c.json({ success: false, error: "入力内容に誤りがあります" }, 400);
    }

    const anchor = await checkOccurrenceAnchor(
      supabase,
      eventId,
      p.occurrenceStart,
    );
    const anchorErr = anchorErrorResponse(c, anchor);
    if (anchorErr) {
      return anchorErr;
    }

    const { error } = await supabase
      .schema("aikiboard")
      .from("event_overrides")
      .upsert(
        {
          event_id: eventId,
          occurrence_start: p.occurrenceStart,
          is_cancelled: false,
          override_start_at: p.startAt ?? null,
          override_end_at: p.endAt ?? null,
          place: p.place ?? null,
          instructor_name: p.instructorName ?? null,
          note: p.note ?? null,
        },
        { onConflict: "event_id,occurrence_start" },
      );
    if (error) {
      logger.error("オカレンス上書きの保存に失敗", {
        feature: "events",
        eventId,
      });
      return c.json({ success: false, error: "更新に失敗しました" }, 500);
    }

    return c.json({ success: true, message: "この回を更新しました" });
  },
);

// ────────────────────────────────────────────────────────────────
// PUT /api/events/:id/rsvp — 自分の出欠表明(メンバー)
// ────────────────────────────────────────────────────────────────
eventsRoute.put(
  "/:id/rsvp",
  authMiddleware,
  boardMemberMiddleware,
  async (c) => {
    const supabase = c.get("supabase");
    if (!supabase) {
      return c.json({ success: false, error: "サーバー設定が不正です" }, 500);
    }
    const userId = c.get("userId");
    const eventId = c.req.param("id");

    const body = await parseJson(c);
    const parsed = rsvpSchema.safeParse(body);
    if (!parsed.success) {
      return c.json({ success: false, error: "入力内容に誤りがあります" }, 400);
    }

    const anchor = await checkOccurrenceAnchor(
      supabase,
      eventId,
      parsed.data.occurrenceStart,
    );
    const anchorErr = anchorErrorResponse(c, anchor);
    if (anchorErr) {
      return anchorErr;
    }

    const { error } = await supabase
      .schema("aikiboard")
      .from("event_rsvps")
      .upsert(
        {
          event_id: eventId,
          occurrence_start: parsed.data.occurrenceStart,
          user_id: userId,
          status: parsed.data.status,
        },
        { onConflict: "event_id,occurrence_start,user_id" },
      );
    if (error) {
      logger.error("出欠の保存に失敗", { feature: "events", eventId, userId });
      return c.json({ success: false, error: "出欠の保存に失敗しました" }, 500);
    }

    return c.json({ success: true, message: "出欠を更新しました" });
  },
);

// ────────────────────────────────────────────────────────────────
// DELETE /api/events/:id/rsvp — 自分の出欠を取り消す(未回答に戻す)(メンバー)
// ────────────────────────────────────────────────────────────────
eventsRoute.delete(
  "/:id/rsvp",
  authMiddleware,
  boardMemberMiddleware,
  async (c) => {
    const supabase = c.get("supabase");
    if (!supabase) {
      return c.json({ success: false, error: "サーバー設定が不正です" }, 500);
    }
    const userId = c.get("userId");
    const eventId = c.req.param("id");

    const body = await parseJson(c);
    const parsed = rsvpDeleteSchema.safeParse(body);
    if (!parsed.success) {
      return c.json({ success: false, error: "入力内容に誤りがあります" }, 400);
    }

    const { error } = await supabase
      .schema("aikiboard")
      .from("event_rsvps")
      .delete()
      .eq("event_id", eventId)
      .eq("occurrence_start", parsed.data.occurrenceStart)
      .eq("user_id", userId);
    if (error) {
      logger.error("出欠の取り消しに失敗", {
        feature: "events",
        eventId,
        userId,
      });
      return c.json(
        { success: false, error: "出欠の取り消しに失敗しました" },
        500,
      );
    }

    return c.json({ success: true, message: "出欠を取り消しました" });
  },
);

// ────────────────────────────────────────────────────────────────
// GET /api/events/:id/rsvps?occurrenceStart= — その回の出欠名簿(メンバー)
//   - 全メンバー: 参加者 / 不参加者(プロフィール画像・氏名つき)を閲覧できる(要件 4.1.3)。
//   - owner/admin のみ: 未回答メンバー一覧 + 件数も返す(出欠集計ビュー)。
// ────────────────────────────────────────────────────────────────
eventsRoute.get(
  "/:id/rsvps",
  authMiddleware,
  boardMemberMiddleware,
  async (c) => {
    const supabase = c.get("supabase");
    if (!supabase) {
      return c.json({ success: false, error: "サーバー設定が不正です" }, 500);
    }
    const eventId = c.req.param("id");
    const boardId = c.get("boardId");
    const boardRole = c.get("boardRole");
    const isAdmin = boardRole === "owner" || boardRole === "admin";

    const occurrenceStart = c.req.query("occurrenceStart");
    if (!occurrenceStart || Number.isNaN(Date.parse(occurrenceStart))) {
      return c.json({ success: false, error: "開催日の指定が必要です" }, 400);
    }

    const anchor = await checkOccurrenceAnchor(
      supabase,
      eventId,
      occurrenceStart,
    );
    const anchorErr = anchorErrorResponse(c, anchor);
    if (anchorErr) {
      return anchorErr;
    }

    const aikiboard = supabase.schema("aikiboard");
    const failWith = (logMessage: string) => {
      logger.error(logMessage, { feature: "events", eventId });
      return c.json({ success: false, error: "出欠の取得に失敗しました" }, 500);
    };

    // この回の出欠(回答済み)。
    const { data: rsvps, error: rsvpError } = await aikiboard
      .from("event_rsvps")
      .select("user_id, status")
      .eq("event_id", eventId)
      .eq("occurrence_start", occurrenceStart);
    if (rsvpError) {
      return failWith("出欠の取得に失敗");
    }
    const statusByUser = new Map<string, "attend" | "decline">();
    for (const r of rsvps ?? []) {
      statusByUser.set(r.user_id, r.status);
    }

    // 現メンバーを取得(全呼び出しで取得する)。
    //   - 名簿は「現在もボードに所属するメンバー」だけを表示する(退会・除名済みの
    //     ユーザーの氏名/画像が名簿に残り続けるのを防ぐ defense-in-depth)。
    //   - 管理者は未回答(回答していない現メンバー)も返す。
    const { data: members, error: memberError } = await aikiboard
      .from("board_members")
      .select("user_id")
      .eq("board_id", boardId);
    if (memberError) {
      return failWith("メンバーの取得に失敗");
    }
    const allMemberIds = (members ?? []).map((m) => m.user_id as string);
    const memberSet = new Set(allMemberIds);

    // 表示に必要なユーザー情報(public."User")をまとめて取得。
    const ids = [...new Set([...statusByUser.keys(), ...allMemberIds])];
    const userById = new Map<
      string,
      { username: string; profileImageUrl: string | null }
    >();
    if (ids.length > 0) {
      const { data: users, error: userError } = await supabase
        .from("User")
        .select("id, username, profile_image_url")
        .in("id", ids);
      if (userError) {
        return failWith("ユーザー情報の取得に失敗");
      }
      for (const u of users ?? []) {
        userById.set(u.id, {
          username: u.username ?? "",
          profileImageUrl: u.profile_image_url ?? null,
        });
      }
      // public."User" が引けなかった id があれば(AikiNote 側の不整合)可観測にする。
      if ((users ?? []).length < ids.length) {
        logger.warn("一部ユーザー情報を解決できませんでした", {
          feature: "events",
          eventId,
        });
      }
    }

    const toMember = (userId: string) => ({
      userId,
      username: userById.get(userId)?.username ?? "",
      profileImageUrl: userById.get(userId)?.profileImageUrl ?? null,
    });
    const byName = (a: { username: string }, b: { username: string }): number =>
      a.username.localeCompare(b.username, "ja");

    // 回答済みのうち「現メンバー」だけを名簿に出す。
    const attendees = [...statusByUser.entries()]
      .filter(([userId, s]) => s === "attend" && memberSet.has(userId))
      .map(([userId]) => toMember(userId))
      .sort(byName);
    const decliners = [...statusByUser.entries()]
      .filter(([userId, s]) => s === "decline" && memberSet.has(userId))
      .map(([userId]) => toMember(userId))
      .sort(byName);
    const nonResponders = isAdmin
      ? allMemberIds
          .filter((id) => !statusByUser.has(id))
          .map(toMember)
          .sort(byName)
      : null;

    return c.json({
      success: true,
      data: {
        attendees,
        decliners,
        nonResponders,
        counts: {
          attending: attendees.length,
          declining: decliners.length,
          nonResponding: nonResponders ? nonResponders.length : null,
        },
      },
    });
  },
);

export default eventsRoute;
