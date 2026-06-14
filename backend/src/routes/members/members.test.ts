import type { SupabaseClient } from "@supabase/supabase-js";
import { Hono } from "hono";
import { sign } from "hono/jwt";
import { describe, expect, it } from "vitest";
import membersRoute from "./index.js";

const SECRET = "test-secret-token-with-at-least-32-characters";
const BOARD_ID = "00000000-0000-0000-0000-0000000000aa";
const ACTOR = "user-1"; // JWT sub
const TARGET = "00000000-0000-0000-0000-0000000000cc";

type Role = "owner" | "admin" | "member" | null;

type ChainState = {
  columns: string;
  single: "maybe" | "single" | null;
  op: "insert" | "update" | "delete" | null;
  filters: Record<string, unknown>;
};

function makeChain(resolver: (s: ChainState) => unknown) {
  const state: ChainState = {
    columns: "",
    single: null,
    op: null,
    filters: {},
  };
  const resolve = () => Promise.resolve(resolver(state));
  const chain: Record<string, unknown> = {
    select: (cols?: string) => {
      if (typeof cols === "string") state.columns = cols;
      return chain;
    },
    eq: (col: string, val: unknown) => {
      state.filters[col] = val;
      return chain;
    },
    in: (col: string, val: unknown) => {
      state.filters[col] = val;
      return chain;
    },
    is: () => chain,
    gt: () => chain,
    order: () => chain,
    insert: () => {
      state.op = "insert";
      return chain;
    },
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

function createMock(opts: {
  role?: Role; // actor の board ロール(middleware)
  targetRole?: Role; // 削除対象の board ロール
  members?: { user_id: string; role: string; joined_at: string }[];
  users?: { id: string; username: string; profile_image_url: string | null }[];
}) {
  const role = opts.role === undefined ? "admin" : opts.role;

  const boardMembersResolver = (s: ChainState) => {
    if (s.single && s.columns === "role") {
      const uid = s.filters.user_id;
      const r = uid === ACTOR ? role : opts.targetRole;
      return { data: r ? { role: r } : null, error: null };
    }
    if (s.op === "delete") return { error: null };
    // 一覧
    return { data: opts.members ?? [], error: null };
  };

  const aikiboard = {
    from: (table: string) => {
      if (table === "board_members") return makeChain(boardMembersResolver);
      if (table === "events" || table === "announcements") {
        return makeChain(() => ({ data: [], error: null }));
      }
      // event_rsvps / announcement_reads(cleanup の delete)
      return makeChain(() => ({ error: null }));
    },
  };

  return {
    supabase: {
      schema: () => aikiboard,
      from: (table: string) =>
        table === "User"
          ? makeChain(() => ({ data: opts.users ?? [], error: null }))
          : makeChain(() => ({ data: [], error: null })),
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
  app.route("/api/members", membersRoute);
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
    const token = await sign({ sub: ACTOR }, SECRET);
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

describe("GET /api/members", () => {
  it("メンバー一覧を owner→admin→member 順で返す", async () => {
    const { supabase } = createMock({
      role: "member",
      members: [
        { user_id: "u-m", role: "member", joined_at: "2026-01-03T00:00:00Z" },
        { user_id: "u-o", role: "owner", joined_at: "2026-01-01T00:00:00Z" },
        { user_id: "u-a", role: "admin", joined_at: "2026-01-02T00:00:00Z" },
      ],
      users: [
        { id: "u-o", username: "道場長", profile_image_url: null },
        { id: "u-a", username: "幹部", profile_image_url: null },
        { id: "u-m", username: "門人", profile_image_url: null },
      ],
    });
    const app = buildApp(supabase);

    const res = await request(app, `/api/members?boardId=${BOARD_ID}`, {
      method: "GET",
    });

    expect(res.status).toBe(200);
    const json = (await res.json()) as { data: { role: string }[] };
    expect(json.data.map((m) => m.role)).toEqual(["owner", "admin", "member"]);
  });
});

describe("DELETE /api/members/:userId", () => {
  it("admin はメンバーを削除できる", async () => {
    const { supabase } = createMock({ role: "admin", targetRole: "member" });
    const app = buildApp(supabase);

    const res = await request(
      app,
      `/api/members/${TARGET}?boardId=${BOARD_ID}`,
      {
        method: "DELETE",
      },
    );

    expect(res.status).toBe(200);
  });

  it("member は削除できない(403)", async () => {
    const { supabase } = createMock({ role: "member", targetRole: "member" });
    const app = buildApp(supabase);

    const res = await request(
      app,
      `/api/members/${TARGET}?boardId=${BOARD_ID}`,
      {
        method: "DELETE",
      },
    );

    expect(res.status).toBe(403);
  });

  it("オーナーは削除できない(400)", async () => {
    const { supabase } = createMock({ role: "admin", targetRole: "owner" });
    const app = buildApp(supabase);

    const res = await request(
      app,
      `/api/members/${TARGET}?boardId=${BOARD_ID}`,
      {
        method: "DELETE",
      },
    );

    expect(res.status).toBe(400);
  });

  it("自分自身は削除できない(400)", async () => {
    const { supabase } = createMock({ role: "owner", targetRole: "owner" });
    const app = buildApp(supabase);

    const res = await request(
      app,
      `/api/members/${ACTOR}?boardId=${BOARD_ID}`,
      {
        method: "DELETE",
      },
    );

    expect(res.status).toBe(400);
  });
});

describe("POST /api/members/leave", () => {
  it("メンバーは自主退会できる", async () => {
    const { supabase } = createMock({ role: "member" });
    const app = buildApp(supabase);

    const res = await request(app, "/api/members/leave", {
      method: "POST",
      body: { boardId: BOARD_ID },
    });

    expect(res.status).toBe(200);
  });

  it("オーナーは退会できない(400)", async () => {
    const { supabase } = createMock({ role: "owner" });
    const app = buildApp(supabase);

    const res = await request(app, "/api/members/leave", {
      method: "POST",
      body: { boardId: BOARD_ID },
    });

    expect(res.status).toBe(400);
  });
});
