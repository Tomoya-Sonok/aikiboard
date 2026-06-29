import type { SupabaseClient } from "@supabase/supabase-js";
import { Hono } from "hono";
import { sign } from "hono/jwt";
import { describe, expect, it } from "vitest";
import boardSettingsRoute from "./index.js";

const SECRET = "test-secret-token-with-at-least-32-characters";
const BOARD_ID = "00000000-0000-0000-0000-0000000000aa";

type Role = "owner" | "admin" | "member" | null;

function createMock(opts: { role?: Role }) {
  const role: Role = opts.role === undefined ? "admin" : opts.role;

  const aikiboard = {
    from: (table: string) => {
      if (table === "board_members") {
        return makeChain(() => ({
          data: role ? { role } : null,
          error: null,
        }));
      }
      if (table === "board_settings") {
        return makeChain((s) => {
          if (s.op === "upsert") return { error: null };
          return {
            data: {
              logo_url: null,
              theme_color_code: "dou",
              description: "サンプル",
              public_page_config: {},
            },
            error: null,
          };
        });
      }
      if (table === "boards") {
        return makeChain((s) => {
          if (s.op === "update") return { error: null };
          return { data: { is_public: true }, error: null };
        });
      }
      return makeChain(() => ({ data: [], error: null }));
    },
  };

  return {
    supabase: {
      schema: () => aikiboard,
      from: () => makeChain(() => ({ data: [], error: null })),
    } as unknown as SupabaseClient,
  };
}

type ChainState = { op: "update" | "upsert" | null };

function makeChain(resolver: (s: ChainState) => unknown) {
  const state: ChainState = { op: null };
  const resolve = () => Promise.resolve(resolver(state));
  const chain: Record<string, unknown> = {
    select: () => chain,
    eq: () => chain,
    update: () => {
      state.op = "update";
      return chain;
    },
    upsert: () => {
      state.op = "upsert";
      return resolve();
    },
    maybeSingle: () => resolve(),
    // biome-ignore lint/suspicious/noThenProperty: クエリビルダのスタブ
    then: (onF: (v: unknown) => unknown, onR?: (e: unknown) => unknown) =>
      resolve().then(onF, onR),
  };
  return chain;
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
  app.route("/api/board-settings", boardSettingsRoute);
  return app;
}

async function request(
  app: Hono<TestEnv>,
  init: { method: string; body?: unknown },
) {
  const token = await sign({ sub: "user-1" }, SECRET);
  return app.request(
    "/api/board-settings?boardId=" +
      (init.method === "GET" ? BOARD_ID : BOARD_ID),
    {
      method: init.method,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
    },
    { SUPABASE_JWT_SECRET: SECRET },
  );
}

describe("GET /api/board-settings", () => {
  it("メンバーは設定を取得できる", async () => {
    const { supabase } = createMock({ role: "member" });
    const app = buildApp(supabase);

    const res = await request(app, { method: "GET" });

    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({
      data: { themeColorCode: "dou", isPublic: true },
    });
  });
});

describe("PATCH /api/board-settings", () => {
  it("admin は設定を更新できる", async () => {
    const { supabase } = createMock({ role: "admin" });
    const app = buildApp(supabase);

    const res = await request(app, {
      method: "PATCH",
      body: { themeColorCode: "ai", isPublic: true, description: "新説明" },
    });

    expect(res.status).toBe(200);
  });

  it("member は更新できない(403)", async () => {
    const { supabase } = createMock({ role: "member" });
    const app = buildApp(supabase);

    const res = await request(app, {
      method: "PATCH",
      body: { themeColorCode: "ai" },
    });

    expect(res.status).toBe(403);
  });

  it("不正なテーマコードは 400", async () => {
    const { supabase } = createMock({ role: "admin" });
    const app = buildApp(supabase);

    const res = await request(app, {
      method: "PATCH",
      body: { themeColorCode: "rainbow" },
    });

    expect(res.status).toBe(400);
  });
});
