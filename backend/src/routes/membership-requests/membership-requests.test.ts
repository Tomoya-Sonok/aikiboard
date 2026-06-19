import type { SupabaseClient } from "@supabase/supabase-js";
import { Hono } from "hono";
import { sign } from "hono/jwt";
import { describe, expect, it } from "vitest";
import requestsRoute from "./index.js";

const SECRET = "test-secret-token-with-at-least-32-characters";
const BOARD_ID = "00000000-0000-0000-0000-0000000000aa";
const REQ_ID = "00000000-0000-0000-0000-0000000000bb";
const DOJO_ID = "00000000-0000-0000-0000-000000000001";
const ACTOR = "user-1";
const APPLICANT = "00000000-0000-0000-0000-0000000000dd";

type Role = "owner" | "admin" | "member" | null;

type ChainState = {
  columns: string;
  single: "maybe" | "single" | null;
  op: "insert" | "update" | null;
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
    in: () => chain,
    order: () => chain,
    insert: () => {
      state.op = "insert";
      return chain;
    },
    update: () => {
      state.op = "update";
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
  // actor の board_members ロール(承認/却下 middleware の admin 判定、
  // および申請時の「すでにメンバー」判定を兼ねる)。null = 非メンバー。
  role?: Role;
  dojoId?: string | null; // User.dojo_style_id
  linked?: boolean; // board が自分の道場に紐づくか(申請)
  requestStatus?: "pending" | "approved" | "rejected"; // decide 対象の状態
}) {
  const role = opts.role === undefined ? null : opts.role;
  const dojoId = opts.dojoId === undefined ? DOJO_ID : opts.dojoId;
  const linked = opts.linked === undefined ? true : opts.linked;
  const requestStatus = opts.requestStatus ?? "pending";

  const dojoResolver = (s: ChainState) => {
    if (s.single && s.columns.includes("dojo_style_id")) {
      return { data: { dojo_style_id: dojoId }, error: null };
    }
    return { data: [], error: null };
  };

  const boardDojoResolver = (s: ChainState) => {
    if (s.single) {
      return { data: linked ? { board_id: BOARD_ID } : null, error: null };
    }
    return { data: linked ? [{ board_id: BOARD_ID }] : [], error: null };
  };

  const boardMembersResolver = (s: ChainState) => {
    if (s.op === "insert") return { error: null };
    if (s.single && s.columns === "role") {
      const uid = s.filters.user_id;
      if (uid === ACTOR) {
        // 承認 middleware の actor、または申請時の existingMember(actor)。
        return { data: role ? { role } : null, error: null };
      }
      // decide の applicant 既存チェック → 未所属
      return { data: null, error: null };
    }
    return { data: [], error: null };
  };

  const requestsResolver = (s: ChainState) => {
    if (s.op === "insert") return { data: { id: REQ_ID }, error: null };
    if (s.op === "update") return { error: null };
    if (s.single && s.columns === "board_id") {
      // middleware の board 解決
      return { data: { board_id: BOARD_ID }, error: null };
    }
    if (s.single && s.columns.includes("user_id, status")) {
      // decide 対象
      return {
        data: { user_id: APPLICANT, status: requestStatus },
        error: null,
      };
    }
    if (s.single && s.columns === "id") {
      // pending 重複チェック → 無し
      return { data: null, error: null };
    }
    return { data: [], error: null };
  };

  const aikiboard = {
    from: (table: string) => {
      if (table === "board_dojo_masters") return makeChain(boardDojoResolver);
      if (table === "board_members") return makeChain(boardMembersResolver);
      if (table === "membership_requests") return makeChain(requestsResolver);
      if (table === "boards") {
        return makeChain(() => ({ data: [], error: null }));
      }
      return makeChain(() => ({ data: [], error: null }));
    },
  };

  return {
    supabase: {
      schema: () => aikiboard,
      from: (table: string) =>
        table === "User"
          ? makeChain(dojoResolver)
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
  app.route("/api/membership-requests", requestsRoute);
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

describe("POST /api/membership-requests", () => {
  it("道場に紐づくボードへ申請できる", async () => {
    const { supabase } = createMock({ linked: true });
    const app = buildApp(supabase);

    const res = await request(app, "/api/membership-requests", {
      method: "POST",
      body: { boardId: BOARD_ID, message: "よろしくお願いします" },
    });

    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ data: { id: REQ_ID } });
  });

  it("AikiNote の道場が未設定なら 400", async () => {
    const { supabase } = createMock({ dojoId: null });
    const app = buildApp(supabase);

    const res = await request(app, "/api/membership-requests", {
      method: "POST",
      body: { boardId: BOARD_ID },
    });

    expect(res.status).toBe(400);
  });

  it("自分の道場に紐づかないボードには申請できない(403)", async () => {
    const { supabase } = createMock({ linked: false });
    const app = buildApp(supabase);

    const res = await request(app, "/api/membership-requests", {
      method: "POST",
      body: { boardId: BOARD_ID },
    });

    expect(res.status).toBe(403);
  });

  it("すでにメンバーなら申請できない(400)", async () => {
    const { supabase } = createMock({ linked: true, role: "member" });
    const app = buildApp(supabase);

    const res = await request(app, "/api/membership-requests", {
      method: "POST",
      body: { boardId: BOARD_ID },
    });

    expect(res.status).toBe(400);
  });

  it("認証が無ければ 401", async () => {
    const { supabase } = createMock({});
    const app = buildApp(supabase);

    const res = await request(app, "/api/membership-requests", {
      method: "POST",
      body: { boardId: BOARD_ID },
      auth: false,
    });

    expect(res.status).toBe(401);
  });
});

describe("GET /api/membership-requests (admin list)", () => {
  it("admin は承認待ち一覧を取得できる", async () => {
    const { supabase } = createMock({ role: "admin" });
    const app = buildApp(supabase);

    const res = await request(
      app,
      `/api/membership-requests?boardId=${BOARD_ID}`,
      { method: "GET" },
    );

    expect(res.status).toBe(200);
  });

  it("member は一覧を取得できない(403)", async () => {
    const { supabase } = createMock({ role: "member" });
    const app = buildApp(supabase);

    const res = await request(
      app,
      `/api/membership-requests?boardId=${BOARD_ID}`,
      { method: "GET" },
    );

    expect(res.status).toBe(403);
  });
});

describe("POST /api/membership-requests/:id/approve", () => {
  it("admin は承認できる", async () => {
    const { supabase } = createMock({ role: "admin" });
    const app = buildApp(supabase);

    const res = await request(
      app,
      `/api/membership-requests/${REQ_ID}/approve`,
      { method: "POST" },
    );

    expect(res.status).toBe(200);
  });

  it("member は承認できない(403)", async () => {
    const { supabase } = createMock({ role: "member" });
    const app = buildApp(supabase);

    const res = await request(
      app,
      `/api/membership-requests/${REQ_ID}/approve`,
      { method: "POST" },
    );

    expect(res.status).toBe(403);
  });

  it("処理済みの申請は 400", async () => {
    const { supabase } = createMock({
      role: "admin",
      requestStatus: "approved",
    });
    const app = buildApp(supabase);

    const res = await request(
      app,
      `/api/membership-requests/${REQ_ID}/approve`,
      { method: "POST" },
    );

    expect(res.status).toBe(400);
  });
});

describe("POST /api/membership-requests/:id/reject", () => {
  it("admin は却下できる", async () => {
    const { supabase } = createMock({ role: "admin" });
    const app = buildApp(supabase);

    const res = await request(
      app,
      `/api/membership-requests/${REQ_ID}/reject`,
      { method: "POST" },
    );

    expect(res.status).toBe(200);
  });
});
