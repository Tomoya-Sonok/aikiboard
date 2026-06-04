import type { SupabaseClient } from "@supabase/supabase-js";
import { Hono } from "hono";
import { sign } from "hono/jwt";
import { describe, expect, it } from "vitest";
import eventsRoute from "./index.js";

const SECRET = "test-secret-token-with-at-least-32-characters";
const BOARD_ID = "00000000-0000-0000-0000-0000000000aa";
const EVENT_ID = "00000000-0000-0000-0000-0000000000bb";
// :id ルートの occurrence アンカー検証用。単発イベントの start_at と一致する開催日。
const ANCHOR = "2026-06-10T10:00:00.000Z";

type Result = { data: unknown; error: unknown };
type Role = "owner" | "admin" | "member" | null;

// events route + boardAccess ミドルウェアが使う supabase 呼び出しを満たすスタブ。
function createEventsMock(opts: {
  role?: Role;
  events?: unknown[];
  overrides?: unknown[];
  rsvps?: unknown[];
  members?: unknown[];
  users?: unknown[];
  insertResult?: Result;
}) {
  const role: Role = opts.role === undefined ? "admin" : opts.role;
  const membership = { data: role ? { role } : null, error: null };

  const eventsBuilder = {
    // 中間: ミドルウェアの select("board_id").eq("id").maybeSingle()(:id ルート用)、
    //       アンカー検証の select("start_at, end_at, recurrence_rule").eq("id").maybeSingle()、
    //       ハンドラの select(cols).eq("board_id")(await で一覧)すべてに応える。
    // await できる(Promise)かつ maybeSingle を持つオブジェクトを返す。
    // maybeSingle は board_id + 単発イベント(start_at=ANCHOR)の両方を満たす行を返す。
    select: () => ({
      eq: () =>
        Object.assign(
          Promise.resolve({ data: opts.events ?? [], error: null } as Result),
          {
            maybeSingle: async () => ({
              data: {
                board_id: BOARD_ID,
                start_at: ANCHOR,
                end_at: "2026-06-10T12:00:00.000Z",
                recurrence_rule: null,
              },
              error: null,
            }),
          },
        ),
    }),
    insert: () => ({
      select: () => ({
        single: async () =>
          opts.insertResult ?? { data: { id: EVENT_ID }, error: null },
      }),
    }),
    update: () => ({ eq: async () => ({ error: null }) }),
    delete: () => ({ eq: async () => ({ error: null }) }),
  };

  const aikiboard = {
    from: (table: string) => {
      if (table === "board_members") {
        return {
          // select("role")→ ロール確認(ミドルウェア)、select("user_id")→ メンバー一覧(名簿)。
          select: (fields: string) =>
            fields === "role"
              ? {
                  eq: () => ({
                    eq: () => ({ maybeSingle: async () => membership }),
                  }),
                }
              : {
                  eq: async () => ({ data: opts.members ?? [], error: null }),
                },
        };
      }
      if (table === "events") {
        return eventsBuilder;
      }
      if (table === "event_overrides") {
        return {
          select: () => ({
            in: async () => ({ data: opts.overrides ?? [], error: null }),
          }),
          upsert: async () => ({ error: null }),
        };
      }
      if (table === "event_rsvps") {
        return {
          select: () => ({
            // 一覧: in().gte().lt()。名簿: eq().eq()(await)。
            in: () => ({
              gte: () => ({
                lt: async () => ({ data: opts.rsvps ?? [], error: null }),
              }),
            }),
            eq: () => ({
              eq: async () => ({ data: opts.rsvps ?? [], error: null }),
            }),
          }),
          upsert: async () => ({ error: null }),
          delete: () => ({
            eq: () => ({ eq: () => ({ eq: async () => ({ error: null }) }) }),
          }),
        };
      }
      return {};
    },
  };

  return {
    supabase: {
      schema: () => aikiboard,
      // public."User"(名簿表示用)。
      from: (table: string) =>
        table === "User"
          ? {
              select: () => ({
                in: async () => ({ data: opts.users ?? [], error: null }),
              }),
            }
          : {},
    } as unknown as SupabaseClient,
  };
}

type TestEnv = {
  Bindings: { SUPABASE_JWT_SECRET?: string };
  Variables: { supabase: SupabaseClient | null; userId?: string };
};

function buildApp(supabase: SupabaseClient | null) {
  const app = new Hono<TestEnv>();
  app.use("*", async (c, next) => {
    c.set("supabase", supabase);
    await next();
  });
  app.route("/api/events", eventsRoute);
  return app;
}

async function request(
  app: Hono<TestEnv>,
  path: string,
  init: { method: string; body?: unknown; auth?: boolean },
) {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (init.auth !== false) {
    const token = await sign({ sub: "user-1" }, SECRET);
    headers.Authorization = `Bearer ${token}`;
  }
  return app.request(
    path,
    {
      method: init.method,
      headers,
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
    },
    { SUPABASE_JWT_SECRET: SECRET },
  );
}

const validCreate = {
  boardId: BOARD_ID,
  startAt: "2026-06-01T10:00:00.000Z",
  endAt: "2026-06-01T12:00:00.000Z",
  place: "本部道場",
  isPublic: true,
};

describe("POST /api/events", () => {
  it("admin は稽古を作成できる", async () => {
    // Arrange
    const { supabase } = createEventsMock({ role: "admin" });
    const app = buildApp(supabase);

    // Act
    const res = await request(app, "/api/events", {
      method: "POST",
      body: validCreate,
    });

    // Assert
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({
      success: true,
      data: { id: EVENT_ID },
    });
  });

  it("毎週の繰り返し設定でも作成できる", async () => {
    // Arrange
    const { supabase } = createEventsMock({ role: "owner" });
    const app = buildApp(supabase);

    // Act
    const res = await request(app, "/api/events", {
      method: "POST",
      body: {
        ...validCreate,
        recurrence: { freq: "WEEKLY", byweekday: ["MO", "WE"] },
      },
    });

    // Assert
    expect(res.status).toBe(200);
  });

  it("member は作成できない(403)", async () => {
    // Arrange
    const { supabase } = createEventsMock({ role: "member" });
    const app = buildApp(supabase);

    // Act
    const res = await request(app, "/api/events", {
      method: "POST",
      body: validCreate,
    });

    // Assert
    expect(res.status).toBe(403);
  });

  it("開始が終了より後なら 400", async () => {
    // Arrange
    const { supabase } = createEventsMock({ role: "admin" });
    const app = buildApp(supabase);

    // Act
    const res = await request(app, "/api/events", {
      method: "POST",
      body: {
        ...validCreate,
        startAt: "2026-06-01T12:00:00.000Z",
        endAt: "2026-06-01T10:00:00.000Z",
      },
    });

    // Assert
    expect(res.status).toBe(400);
  });

  it("認証が無ければ 401", async () => {
    // Arrange
    const { supabase } = createEventsMock({ role: "admin" });
    const app = buildApp(supabase);

    // Act
    const res = await request(app, "/api/events", {
      method: "POST",
      body: validCreate,
      auth: false,
    });

    // Assert
    expect(res.status).toBe(401);
  });
});

describe("GET /api/events", () => {
  it("オカレンスを集計・自分の出欠つきで返す", async () => {
    // Arrange(単発イベント 1 件 + 自分の attend)
    const { supabase } = createEventsMock({
      role: "member",
      events: [
        {
          id: EVENT_ID,
          start_at: "2026-06-10T10:00:00.000Z",
          end_at: "2026-06-10T12:00:00.000Z",
          place: "本部道場",
          instructor_name: null,
          note: null,
          recurrence_rule: null,
          is_public: true,
        },
      ],
      rsvps: [
        {
          event_id: EVENT_ID,
          occurrence_start: "2026-06-10T10:00:00.000Z",
          user_id: "user-1",
          status: "attend",
        },
      ],
    });
    const app = buildApp(supabase);

    // Act
    const res = await request(
      app,
      `/api/events?boardId=${BOARD_ID}&from=2026-06-01T00:00:00.000Z&to=2026-07-01T00:00:00.000Z`,
      { method: "GET" },
    );

    // Assert
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.data).toHaveLength(1);
    expect(body.data[0]).toMatchObject({
      eventId: EVENT_ID,
      occurrenceStart: "2026-06-10T10:00:00.000Z",
      attendingCount: 1,
      myStatus: "attend",
      canManage: false,
    });
  });

  it("期間指定が無ければ 400", async () => {
    // Arrange
    const { supabase } = createEventsMock({ role: "member" });
    const app = buildApp(supabase);

    // Act
    const res = await request(app, `/api/events?boardId=${BOARD_ID}`, {
      method: "GET",
    });

    // Assert
    expect(res.status).toBe(400);
  });
});

describe("PUT /api/events/:id/rsvp", () => {
  it("メンバーは正規の開催日に自分の出欠を表明できる", async () => {
    // Arrange
    const { supabase } = createEventsMock({ role: "member" });
    const app = buildApp(supabase);

    // Act
    const res = await request(app, `/api/events/${EVENT_ID}/rsvp`, {
      method: "PUT",
      body: { occurrenceStart: ANCHOR, status: "attend" },
    });

    // Assert
    expect(res.status).toBe(200);
  });

  it("シリーズに存在しない開催日(アンカー不一致)は 400", async () => {
    // Arrange(単発イベントの start_at=ANCHOR と異なる日付)
    const { supabase } = createEventsMock({ role: "member" });
    const app = buildApp(supabase);

    // Act
    const res = await request(app, `/api/events/${EVENT_ID}/rsvp`, {
      method: "PUT",
      body: { occurrenceStart: "2026-06-11T10:00:00.000Z", status: "attend" },
    });

    // Assert
    expect(res.status).toBe(400);
  });

  it("status が不正なら 400", async () => {
    // Arrange
    const { supabase } = createEventsMock({ role: "member" });
    const app = buildApp(supabase);

    // Act
    const res = await request(app, `/api/events/${EVENT_ID}/rsvp`, {
      method: "PUT",
      body: { occurrenceStart: "2026-06-10T10:00:00.000Z", status: "maybe" },
    });

    // Assert
    expect(res.status).toBe(400);
  });
});

describe("DELETE /api/events/:id", () => {
  it("member は削除できない(403)", async () => {
    // Arrange
    const { supabase } = createEventsMock({ role: "member" });
    const app = buildApp(supabase);

    // Act
    const res = await request(app, `/api/events/${EVENT_ID}`, {
      method: "DELETE",
    });

    // Assert
    expect(res.status).toBe(403);
  });

  it("admin は削除できる", async () => {
    // Arrange
    const { supabase } = createEventsMock({ role: "admin" });
    const app = buildApp(supabase);

    // Act
    const res = await request(app, `/api/events/${EVENT_ID}`, {
      method: "DELETE",
    });

    // Assert
    expect(res.status).toBe(200);
  });
});

describe("GET /api/events/:id/rsvps", () => {
  const users = [
    { id: "u1", username: "あいざわ", profile_image_url: null },
    { id: "u2", username: "いとう", profile_image_url: "https://img/u2" },
    { id: "u3", username: "うえだ", profile_image_url: null },
  ];

  it("メンバーは参加者・不参加者を取得できる(未回答は含まない)", async () => {
    // Arrange
    const { supabase } = createEventsMock({
      role: "member",
      rsvps: [
        { user_id: "u1", status: "attend" },
        { user_id: "u2", status: "decline" },
      ],
      members: [{ user_id: "u1" }, { user_id: "u2" }],
      users,
    });
    const app = buildApp(supabase);

    // Act
    const res = await request(
      app,
      `/api/events/${EVENT_ID}/rsvps?occurrenceStart=${ANCHOR}`,
      { method: "GET" },
    );

    // Assert
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.data.attendees).toHaveLength(1);
    expect(body.data.attendees[0]).toMatchObject({ userId: "u1" });
    expect(body.data.decliners).toHaveLength(1);
    expect(body.data.nonResponders).toBeNull();
  });

  it("管理者は未回答メンバーと件数も取得できる", async () => {
    // Arrange(回答は u1 のみ、メンバーは u1/u2/u3)
    const { supabase } = createEventsMock({
      role: "admin",
      rsvps: [{ user_id: "u1", status: "attend" }],
      members: [{ user_id: "u1" }, { user_id: "u2" }, { user_id: "u3" }],
      users,
    });
    const app = buildApp(supabase);

    // Act
    const res = await request(
      app,
      `/api/events/${EVENT_ID}/rsvps?occurrenceStart=${ANCHOR}`,
      { method: "GET" },
    );

    // Assert
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.data.nonResponders).toHaveLength(2);
    expect(body.data.counts).toMatchObject({
      attending: 1,
      declining: 0,
      nonResponding: 2,
    });
  });

  it("開催日の指定が無ければ 400", async () => {
    // Arrange
    const { supabase } = createEventsMock({ role: "member" });
    const app = buildApp(supabase);

    // Act
    const res = await request(app, `/api/events/${EVENT_ID}/rsvps`, {
      method: "GET",
    });

    // Assert
    expect(res.status).toBe(400);
  });
});
