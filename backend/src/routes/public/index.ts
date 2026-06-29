// 公開ページ API(要件 4.7 / 4.1.2)。**未認証(anon)でアクセスできる**。
//
//   - GET /api/public/boards/:slug          : 公開ボードのプロフィール
//   - GET /api/public/boards/:slug/events   : 公開カレンダー(is_public な稽古のみ)
//
// authMiddleware は通さない(誰でもアクセスできる公開エンドポイント)。
// 公開対象は boards.is_public = true のボードに限定し、events も is_public のものだけ返す。
// メンバー一覧・出欠などの内部情報は一切返さない(要件 5.4 の公開範囲)。
// backend は service_role で動くため、ここでの is_public チェックが公開範囲の砦。

import { Hono } from "hono";
import type { AppBindings, AppVariables } from "../../app.js";
import { logger } from "../../lib/logger.js";
import {
  applyOverrides,
  expandEvent,
  type OccurrenceOverride,
} from "../../lib/recurrence.js";

type PublicEnv = { Bindings: AppBindings; Variables: AppVariables };

const publicRoute = new Hono<PublicEnv>();

const MAX_WINDOW_DAYS = 100;

// GET /api/public/boards/:slug — 公開ボードのプロフィール(anon)。
publicRoute.get("/boards/:slug", async (c) => {
  const supabase = c.get("supabase");
  if (!supabase) {
    return c.json({ success: false, error: "サーバー設定が不正です" }, 500);
  }
  const slug = c.req.param("slug");
  const aikiboard = supabase.schema("aikiboard");

  const { data: board, error } = await aikiboard
    .from("boards")
    .select("id, name, slug, is_public")
    .eq("slug", slug)
    .maybeSingle();
  if (error) {
    logger.error("公開ボードの取得に失敗", { feature: "public", slug });
    return c.json({ success: false, error: "取得に失敗しました" }, 500);
  }
  // 非公開・存在しないボードは一律 404(存在を伏せる)。
  if (!board || board.is_public !== true) {
    return c.json({ success: false, error: "対象が見つかりません" }, 404);
  }
  const boardId = board.id as string;

  const [settingsRes, dojoLinkRes] = await Promise.all([
    aikiboard
      .from("board_settings")
      .select("logo_url, theme_color_code, description, public_page_config")
      .eq("board_id", boardId)
      .maybeSingle(),
    aikiboard
      .from("board_dojo_masters")
      .select("dojo_master_id, is_primary")
      .eq("board_id", boardId),
  ]);

  // 紐づく道場マスタ名(公開情報)。
  const dojoIds = (dojoLinkRes.data ?? []).map(
    (l) => l.dojo_master_id as string,
  );
  let dojoNames: string[] = [];
  if (dojoIds.length > 0) {
    const { data: dojos } = await supabase
      .from("DojoStyleMaster")
      .select("id, dojo_name")
      .in("id", dojoIds);
    dojoNames = (dojos ?? []).map((d) => d.dojo_name as string);
  }

  return c.json({
    success: true,
    data: {
      name: board.name as string,
      slug: board.slug as string,
      logoUrl: (settingsRes.data?.logo_url as string | null) ?? null,
      themeColorCode:
        (settingsRes.data?.theme_color_code as string | null) ?? "sumi",
      description: (settingsRes.data?.description as string | null) ?? null,
      publicPageConfig: settingsRes.data?.public_page_config ?? {},
      dojoNames,
    },
  });
});

// GET /api/public/boards/:slug/events?from=&to= — 公開カレンダー(anon)。
publicRoute.get("/boards/:slug/events", async (c) => {
  const supabase = c.get("supabase");
  if (!supabase) {
    return c.json({ success: false, error: "サーバー設定が不正です" }, 500);
  }
  const slug = c.req.param("slug");
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

  const { data: board, error: boardError } = await aikiboard
    .from("boards")
    .select("id, is_public")
    .eq("slug", slug)
    .maybeSingle();
  if (boardError) {
    return c.json({ success: false, error: "取得に失敗しました" }, 500);
  }
  if (!board || board.is_public !== true) {
    return c.json({ success: false, error: "対象が見つかりません" }, 404);
  }
  const boardId = board.id as string;

  // is_public な稽古のみ展開する。出欠・名簿などの内部情報は返さない。
  const { data: events, error: eventsError } = await aikiboard
    .from("events")
    .select(
      "id, start_at, end_at, place, instructor_name, note, recurrence_rule",
    )
    .eq("board_id", boardId)
    .eq("is_public", true);
  if (eventsError) {
    logger.error("公開カレンダーの取得に失敗", { feature: "public", slug });
    return c.json({ success: false, error: "取得に失敗しました" }, 500);
  }
  if (!events || events.length === 0) {
    return c.json({ success: true, data: [] });
  }

  const eventIds = events.map((e) => e.id as string);
  const { data: overrides } = await aikiboard
    .from("event_overrides")
    .select(
      "event_id, occurrence_start, is_cancelled, override_start_at, override_end_at, place, instructor_name, note",
    )
    .in("event_id", eventIds);

  const overridesByEvent = new Map<string, OccurrenceOverride[]>();
  for (const o of overrides ?? []) {
    const list = overridesByEvent.get(o.event_id as string) ?? [];
    list.push({
      occurrenceStart: o.occurrence_start as string,
      isCancelled: o.is_cancelled as boolean,
      overrideStartAt: o.override_start_at as string | null,
      overrideEndAt: o.override_end_at as string | null,
      place: o.place as string | null,
      instructorName: o.instructor_name as string | null,
      note: o.note as string | null,
    });
    overridesByEvent.set(o.event_id as string, list);
  }

  const occurrences: Array<{
    eventId: string;
    occurrenceStart: string;
    startAt: string;
    endAt: string;
    place: string;
    instructorName: string | null;
    note: string | null;
  }> = [];
  for (const event of events) {
    const raw = expandEvent(
      {
        startAt: event.start_at as string,
        endAt: event.end_at as string,
        recurrenceRule: event.recurrence_rule as string | null,
      },
      new Date(fromMs).toISOString(),
      new Date(toMs).toISOString(),
    );
    const effective = applyOverrides(
      raw,
      overridesByEvent.get(event.id as string) ?? [],
    );
    for (const occ of effective) {
      const ov = occ.override;
      occurrences.push({
        eventId: event.id as string,
        occurrenceStart: occ.occurrenceStart,
        startAt: occ.startAt,
        endAt: occ.endAt,
        place: (ov?.place ?? (event.place as string)) as string,
        instructorName:
          ov?.instructorName ?? (event.instructor_name as string | null),
        note: ov?.note ?? (event.note as string | null),
      });
    }
  }
  occurrences.sort((a, b) => Date.parse(a.startAt) - Date.parse(b.startAt));

  return c.json({ success: true, data: occurrences });
});

export default publicRoute;
