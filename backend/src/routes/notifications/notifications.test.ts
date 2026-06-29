import type { SupabaseClient } from "@supabase/supabase-js";
import { Hono } from "hono";
import { sign } from "hono/jwt";
import { describe, expect, it } from "vitest";
import notificationsRoute from "./index.js";

const SECRET = "test-secret-token-with-at-least-32-characters";
const BOARD_ID = "00000000-0000-0000-0000-0000000000aa";
const NOTI_ID = "00000000-0000-0000-0000-0000000000bb";

type Role = "owner" | "admin" | "member" | null;

function createMock(opts: {
  role?: Role;
  listRows?: Record<string, unknown>[];
  listCount?: number;
  unreadCount?: number;
}) {
  const role: Role = opts.role === undefined ? "member" : opts.role;

  const notificationsResolver = (state: ChainState) => {
    if (state.op === "update" || state.op === "delete") {
      return { error: null };
    }
    if (state.head) {
      return { count: opts.unreadCount ?? 0, error: null };
    }
    return {
      data: opts.listRows ?? [],
      error: null,
      count: opts.listCount ?? opts.listRows?.length ?? 0,
    };
  };

  const aikiboard = {
    from: (table: string) => {
      if (table === "board_members") {
        return makeChain(() => ({
          data: role ? { role } : null,
          error: null,
        }));
      }
      if (table === "notifications") {
        return makeChain(notificationsResolver);
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
  columns: string;
  single: "maybe" | "single" | null;
  head: boolean;
  op: "insert" | "update" | "delete" | "upsert" | null;
};

function makeChain(resolver: (state: ChainState) => unknown) {
  const state: ChainState = {
    columns: "",
    single: null,
    head: false,
    op: null,
  };
  const resolve = () => Promise.resolve(resolver(state));
  const chain: Record<string, unknown> = {
    select: (cols?: string, options?: { head?: boolean }) => {
      if (typeof cols === "string") state.columns = cols;
      if (options?.head) state.head = true;
      return chain;
    },
    eq: () => chain,
    order: () => chain,
    range: () => chain,
    update: () => {
      state.op = "update";
      return chain;
    },
    delete: () => {
      state.op = "delete";
      return chain;
    },
    maybeSingle: () => {
      state.single = "maybe";
      return resolve();
    },
    single: () => {
      state.single = "single";
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
  app.route("/api/notifications", notificationsRoute);
  return app;
}

async function request(
  app: Hono<TestEnv>,
  path: string,
  init: { method: string; auth?: boolean },
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
    { method: init.method, headers },
    { SUPABASE_JWT_SECRET: SECRET },
  );
}

describe("GET /api/notifications", () => {
  it("メンバーは自分の通知一覧を取得できる", async () => {
    const { supabase } = createMock({
      role: "member",
      listRows: [
        {
          id: NOTI_ID,
          type: "announcement.published",
          target_type: "announcement",
          target_id: NOTI_ID,
          metadata: { actorName: "道場長", title: "審査案内" },
          is_read: false,
          created_at: "2026-06-01T00:00:00.000Z",
        },
      ],
      listCount: 1,
    });
    const app = buildApp(supabase);

    const res = await request(app, `/api/notifications?boardId=${BOARD_ID}`, {
      method: "GET",
    });

    expect(res.status).toBe(200);
    const json = (await res.json()) as {
      data: { items: { actorName: string; title: string }[] };
    };
    expect(json.data.items[0].actorName).toBe("道場長");
    expect(json.data.items[0].title).toBe("審査案内");
  });

  it("非メンバーは 404", async () => {
    const { supabase } = createMock({ role: null });
    const app = buildApp(supabase);

    const res = await request(app, `/api/notifications?boardId=${BOARD_ID}`, {
      method: "GET",
    });

    expect(res.status).toBe(404);
  });
});

describe("GET /api/notifications/unread-count", () => {
  it("未読数を返す", async () => {
    const { supabase } = createMock({ role: "member", unreadCount: 3 });
    const app = buildApp(supabase);

    const res = await request(
      app,
      `/api/notifications/unread-count?boardId=${BOARD_ID}`,
      { method: "GET" },
    );

    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ data: { count: 3 } });
  });
});

describe("PUT /api/notifications/:id/read", () => {
  it("自分の通知を既読にできる", async () => {
    const { supabase } = createMock({ role: "member" });
    const app = buildApp(supabase);

    const res = await request(app, `/api/notifications/${NOTI_ID}/read`, {
      method: "PUT",
    });

    expect(res.status).toBe(200);
  });

  it("認証が無ければ 401", async () => {
    const { supabase } = createMock({ role: "member" });
    const app = buildApp(supabase);

    const res = await request(app, `/api/notifications/${NOTI_ID}/read`, {
      method: "PUT",
      auth: false,
    });

    expect(res.status).toBe(401);
  });
});

describe("POST /api/notifications/read-all", () => {
  it("全既読にできる", async () => {
    const { supabase } = createMock({ role: "member" });
    const app = buildApp(supabase);

    const res = await request(
      app,
      `/api/notifications/read-all?boardId=${BOARD_ID}`,
      { method: "POST" },
    );

    expect(res.status).toBe(200);
  });
});
