import type { SupabaseClient } from "@supabase/supabase-js";
import { Hono } from "hono";
import { describe, expect, it } from "vitest";
import publicRoute from "./index.js";

// 公開ルートは authMiddleware を通さない(anon)。boards.is_public で公開範囲を制御する。
function createMock(opts: {
  isPublic?: boolean | null; // null = ボード無し
  events?: Record<string, unknown>[];
}) {
  const boardRow =
    opts.isPublic === null || opts.isPublic === undefined
      ? null
      : {
          id: "board-1",
          name: "蕨合気道会",
          slug: "warabi",
          is_public: opts.isPublic,
        };

  const aikiboard = {
    from: (table: string) => {
      if (table === "boards") {
        return makeChain(() => ({ data: boardRow, error: null }));
      }
      if (table === "board_settings") {
        return makeChain(() => ({
          data: {
            logo_url: null,
            theme_color_code: "dou",
            description: "稽古しています",
            public_page_config: { showCalendar: true },
          },
          error: null,
        }));
      }
      if (table === "board_dojo_masters") {
        return makeChain(() => ({
          data: [{ dojo_master_id: "dojo-1", is_primary: true }],
          error: null,
        }));
      }
      if (table === "events") {
        return makeChain(() => ({ data: opts.events ?? [], error: null }));
      }
      if (table === "event_overrides") {
        return makeChain(() => ({ data: [], error: null }));
      }
      return makeChain(() => ({ data: [], error: null }));
    },
  };

  return {
    supabase: {
      schema: () => aikiboard,
      from: (table: string) =>
        table === "DojoStyleMaster"
          ? makeChain(() => ({
              data: [{ id: "dojo-1", dojo_name: "蕨合気道会" }],
              error: null,
            }))
          : makeChain(() => ({ data: [], error: null })),
    } as unknown as SupabaseClient,
  };
}

function makeChain(resolver: () => unknown) {
  const resolve = () => Promise.resolve(resolver());
  const chain: Record<string, unknown> = {
    select: () => chain,
    eq: () => chain,
    in: () => chain,
    maybeSingle: () => resolve(),
    // biome-ignore lint/suspicious/noThenProperty: クエリビルダのスタブ
    then: (onF: (v: unknown) => unknown, onR?: (e: unknown) => unknown) =>
      resolve().then(onF, onR),
  };
  return chain;
}

type TestEnv = { Variables: { supabase: SupabaseClient | null } };

function buildApp(supabase: SupabaseClient | null) {
  const app = new Hono<TestEnv>();
  app.use("*", async (c, next) => {
    c.set("supabase", supabase);
    await next();
  });
  app.route("/api/public", publicRoute);
  return app;
}

describe("GET /api/public/boards/:slug", () => {
  it("公開ボードはプロフィールを返す(認証不要)", async () => {
    const { supabase } = createMock({ isPublic: true });
    const app = buildApp(supabase);

    const res = await app.request("/api/public/boards/warabi");

    expect(res.status).toBe(200);
    const json = (await res.json()) as {
      data: { name: string; dojoNames: string[] };
    };
    expect(json.data.name).toBe("蕨合気道会");
    expect(json.data.dojoNames).toContain("蕨合気道会");
  });

  it("非公開ボードは 404", async () => {
    const { supabase } = createMock({ isPublic: false });
    const app = buildApp(supabase);

    const res = await app.request("/api/public/boards/warabi");

    expect(res.status).toBe(404);
  });

  it("存在しないボードは 404", async () => {
    const { supabase } = createMock({ isPublic: null });
    const app = buildApp(supabase);

    const res = await app.request("/api/public/boards/nope");

    expect(res.status).toBe(404);
  });
});

describe("GET /api/public/boards/:slug/events", () => {
  it("公開稽古を期間展開して返す", async () => {
    const { supabase } = createMock({
      isPublic: true,
      events: [
        {
          id: "e1",
          start_at: "2026-06-02T10:00:00.000Z",
          end_at: "2026-06-02T11:30:00.000Z",
          place: "蕨市民体育館",
          instructor_name: "岩片裕",
          note: null,
          recurrence_rule: null,
        },
      ],
    });
    const app = buildApp(supabase);

    const res = await app.request(
      "/api/public/boards/warabi/events?from=2026-06-01T00:00:00.000Z&to=2026-06-30T00:00:00.000Z",
    );

    expect(res.status).toBe(200);
    const json = (await res.json()) as { data: { place: string }[] };
    expect(json.data.length).toBe(1);
    expect(json.data[0].place).toBe("蕨市民体育館");
  });

  it("非公開ボードのカレンダーは 404", async () => {
    const { supabase } = createMock({ isPublic: false });
    const app = buildApp(supabase);

    const res = await app.request(
      "/api/public/boards/warabi/events?from=2026-06-01T00:00:00.000Z&to=2026-06-30T00:00:00.000Z",
    );

    expect(res.status).toBe(404);
  });
});
