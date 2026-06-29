import type { SupabaseClient } from "@supabase/supabase-js";
import { Hono } from "hono";
import { sign } from "hono/jwt";
import { describe, expect, it } from "vitest";
import activityLogsRoute from "./index.js";

const SECRET = "test-secret-token-with-at-least-32-characters";
const BOARD_ID = "00000000-0000-0000-0000-0000000000aa";

type Role = "owner" | "admin" | "member" | null;

// activity-logs route + boardAdmin + featureGuard が使う supabase 呼び出しを満たすスタブ。
function createMock(opts: {
  role?: Role;
  // 契約プランで使える feature code(activity_log を含むかで gate を切替)。
  featureCodes?: string[];
  listRows?: Record<string, unknown>[];
  listCount?: number;
}) {
  const role: Role = opts.role === undefined ? "admin" : opts.role;
  const features = opts.featureCodes ?? ["activity_log"];

  const aikiboard = {
    from: (table: string) => {
      if (table === "board_members") {
        return makeChain(() => ({
          data: role ? { role } : null,
          error: null,
        }));
      }
      if (table === "board_subscriptions") {
        return makeChain(() => ({
          data: { plan_id: "plan-1", status: "active" },
          error: null,
        }));
      }
      if (table === "plans") {
        return makeChain(() => ({ data: { id: "free-1" }, error: null }));
      }
      if (table === "plan_features") {
        return makeChain(() => ({
          data: features.map((c) => ({ feature_code: c })),
          error: null,
        }));
      }
      if (table === "activity_logs") {
        return makeChain(() => ({
          data: opts.listRows ?? [],
          error: null,
          count: opts.listCount ?? opts.listRows?.length ?? 0,
        }));
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

type ChainState = {
  single: "maybe" | "single" | null;
};

function makeChain(resolver: (state: ChainState) => unknown) {
  const state: ChainState = { single: null };
  const resolve = () => Promise.resolve(resolver(state));
  const chain: Record<string, unknown> = {
    select: () => chain,
    eq: () => chain,
    order: () => chain,
    range: () => chain,
    maybeSingle: () => {
      state.single = "maybe";
      return resolve();
    },
    // biome-ignore lint/suspicious/noThenProperty: クエリビルダのスタブとして await 可能にする
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
  app.route("/api/activity-logs", activityLogsRoute);
  return app;
}

async function request(app: Hono<TestEnv>, path: string, auth = true) {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (auth) {
    const token = await sign({ sub: "user-1" }, SECRET);
    headers.Authorization = `Bearer ${token}`;
  }
  return app.request(
    path,
    { method: "GET", headers },
    { SUPABASE_JWT_SECRET: SECRET },
  );
}

describe("GET /api/activity-logs", () => {
  it("activity_log 機能ありの admin は履歴を取得できる", async () => {
    const { supabase } = createMock({
      role: "admin",
      featureCodes: ["activity_log"],
      listRows: [
        {
          id: "00000000-0000-0000-0000-0000000000cc",
          user_id: "u1",
          action: "event.created",
          target_type: "event",
          target_id: "e1",
          metadata: { actorName: "道場長", title: "蕨市民体育館" },
          created_at: "2026-06-01T00:00:00.000Z",
        },
      ],
      listCount: 1,
    });
    const app = buildApp(supabase);

    const res = await request(app, `/api/activity-logs?boardId=${BOARD_ID}`);

    expect(res.status).toBe(200);
    const json = (await res.json()) as {
      data: { items: { action: string; actorName: string }[] };
    };
    expect(json.data.items[0].action).toBe("event.created");
    expect(json.data.items[0].actorName).toBe("道場長");
  });

  it("activity_log 機能なし(Free 相当)は 403(feature_locked)", async () => {
    const { supabase } = createMock({
      role: "admin",
      featureCodes: ["calendar", "announcements"],
    });
    const app = buildApp(supabase);

    const res = await request(app, `/api/activity-logs?boardId=${BOARD_ID}`);

    expect(res.status).toBe(403);
    expect(await res.json()).toMatchObject({ code: "feature_locked" });
  });

  it("一般メンバーは 403(管理者のみ)", async () => {
    const { supabase } = createMock({ role: "member" });
    const app = buildApp(supabase);

    const res = await request(app, `/api/activity-logs?boardId=${BOARD_ID}`);

    expect(res.status).toBe(403);
  });

  it("非メンバーは 404", async () => {
    const { supabase } = createMock({ role: null });
    const app = buildApp(supabase);

    const res = await request(app, `/api/activity-logs?boardId=${BOARD_ID}`);

    expect(res.status).toBe(404);
  });
});
