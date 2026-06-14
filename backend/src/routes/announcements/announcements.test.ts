import type { SupabaseClient } from "@supabase/supabase-js";
import { Hono } from "hono";
import { sign } from "hono/jwt";
import { describe, expect, it } from "vitest";
import announcementsRoute from "./index.js";

const SECRET = "test-secret-token-with-at-least-32-characters";
const BOARD_ID = "00000000-0000-0000-0000-0000000000aa";
const ANN_ID = "00000000-0000-0000-0000-0000000000bb";

type Role = "owner" | "admin" | "member" | null;

const validBody = {
  type: "doc",
  content: [{ type: "paragraph", content: [{ type: "text", text: "本文" }] }],
};

// announcements route + boardAccess ミドルウェアが使う supabase 呼び出しを満たすスタブ。
// チェーンの終端(maybeSingle / single / await / upsert)で、select した列や op を見て
// 返す結果を切り替える。
function createMock(opts: {
  role?: Role;
  // :id ルートのミドルウェアが引く board_id(null で 404)。
  resolvedBoardId?: string | null;
  // 詳細/publish/read が select("...published_at...").maybeSingle() で得る行。
  targetRow?: Record<string, unknown> | null;
  listRows?: Record<string, unknown>[];
  listCount?: number;
  reads?: { announcement_id: string }[];
  users?: { id: string; username: string }[];
  insertResult?: { data: { id: string } | null; error: unknown };
}) {
  const role: Role = opts.role === undefined ? "admin" : opts.role;
  const resolvedBoardId =
    opts.resolvedBoardId === undefined ? BOARD_ID : opts.resolvedBoardId;

  const announcementsResolver = (state: ChainState) => {
    // ミドルウェア: select("board_id").eq("id").maybeSingle()
    if (state.columns === "board_id" && state.single) {
      return {
        data: resolvedBoardId ? { board_id: resolvedBoardId } : null,
        error: null,
      };
    }
    if (state.op === "insert") {
      return opts.insertResult ?? { data: { id: ANN_ID }, error: null };
    }
    if (state.op === "update" || state.op === "delete") {
      return { error: null };
    }
    // 詳細/publish/read: 単一行
    if (state.single) {
      return { data: opts.targetRow ?? null, error: null };
    }
    // 一覧(await)
    return {
      data: opts.listRows ?? [],
      error: null,
      count: opts.listCount ?? opts.listRows?.length ?? 0,
    };
  };

  const readsResolver = (state: ChainState) => {
    if (state.op === "upsert") {
      return { error: null };
    }
    if (state.single) {
      return { data: null, error: null };
    }
    return { data: opts.reads ?? [], error: null };
  };

  const aikiboard = {
    from: (table: string) => {
      if (table === "board_members") {
        return makeChain(() => ({
          data: role ? { role } : null,
          error: null,
        }));
      }
      if (table === "announcements") {
        return makeChain(announcementsResolver);
      }
      if (table === "announcement_reads") {
        return makeChain(readsResolver);
      }
      return makeChain(() => ({ data: [], error: null }));
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

type ChainState = {
  columns: string;
  single: "maybe" | "single" | null;
  op: "insert" | "update" | "delete" | "upsert" | null;
};

// select した列や op を記録しつつ、終端で resolver(state) を解決する thenable チェーン。
function makeChain(resolver: (state: ChainState) => unknown) {
  const state: ChainState = { columns: "", single: null, op: null };
  const resolve = () => Promise.resolve(resolver(state));
  const chain: Record<string, unknown> = {
    select: (cols?: string) => {
      if (typeof cols === "string") state.columns = cols;
      return chain;
    },
    eq: () => chain,
    not: () => chain,
    in: () => chain,
    order: () => chain,
    range: () => chain,
    gte: () => chain,
    lt: () => chain,
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
    upsert: () => {
      state.op = "upsert";
      return resolve();
    },
    maybeSingle: () => {
      state.single = "maybe";
      return resolve();
    },
    single: () => {
      state.single = "single";
      return resolve();
    },
    // PostgREST のクエリビルダ(await でクエリ実行)を模すため、意図的に thenable にする。
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
  app.route("/api/announcements", announcementsRoute);
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

describe("POST /api/announcements", () => {
  it("admin は下書きを作成できる", async () => {
    const { supabase } = createMock({ role: "admin" });
    const app = buildApp(supabase);

    const res = await request(app, "/api/announcements", {
      method: "POST",
      body: { boardId: BOARD_ID, title: "審査案内", bodyRich: validBody },
    });

    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({
      success: true,
      data: { id: ANN_ID },
    });
  });

  it("member は作成できない(403)", async () => {
    const { supabase } = createMock({ role: "member" });
    const app = buildApp(supabase);

    const res = await request(app, "/api/announcements", {
      method: "POST",
      body: { boardId: BOARD_ID, title: "x", bodyRich: validBody },
    });

    expect(res.status).toBe(403);
  });

  it("不正な本文(未知ノード)は 400", async () => {
    const { supabase } = createMock({ role: "admin" });
    const app = buildApp(supabase);

    const res = await request(app, "/api/announcements", {
      method: "POST",
      body: {
        boardId: BOARD_ID,
        title: "x",
        bodyRich: { type: "doc", content: [{ type: "image" }] },
      },
    });

    expect(res.status).toBe(400);
  });

  it("認証が無ければ 401", async () => {
    const { supabase } = createMock({ role: "admin" });
    const app = buildApp(supabase);

    const res = await request(app, "/api/announcements", {
      method: "POST",
      body: { boardId: BOARD_ID, title: "x", bodyRich: validBody },
      auth: false,
    });

    expect(res.status).toBe(401);
  });
});

describe("GET /api/announcements", () => {
  it("member には公開済みのみ返す(下書きは isDraft=false の公開行のみ)", async () => {
    const { supabase } = createMock({
      role: "member",
      listRows: [
        {
          id: ANN_ID,
          title: "公開済み",
          body_rich: validBody,
          notify_email: false,
          created_by_user_id: "u1",
          published_at: "2026-06-01T00:00:00.000Z",
          created_at: "2026-06-01T00:00:00.000Z",
        },
      ],
      listCount: 1,
      users: [{ id: "u1", username: "道場長" }],
    });
    const app = buildApp(supabase);

    const res = await request(app, `/api/announcements?boardId=${BOARD_ID}`, {
      method: "GET",
    });

    expect(res.status).toBe(200);
    const json = (await res.json()) as {
      data: {
        items: { isDraft: boolean; authorName: string }[];
        total: number;
      };
    };
    expect(json.data.total).toBe(1);
    expect(json.data.items[0].isDraft).toBe(false);
    expect(json.data.items[0].authorName).toBe("道場長");
  });
});

describe("GET /api/announcements/:id", () => {
  it("下書きは member には 404", async () => {
    const { supabase } = createMock({
      role: "member",
      targetRow: {
        id: ANN_ID,
        title: "下書き",
        body_rich: validBody,
        notify_email: false,
        created_by_user_id: "u1",
        published_at: null,
        created_at: "2026-06-01T00:00:00.000Z",
      },
    });
    const app = buildApp(supabase);

    const res = await request(app, `/api/announcements/${ANN_ID}`, {
      method: "GET",
    });

    expect(res.status).toBe(404);
  });

  it("下書きでも admin には返す", async () => {
    const { supabase } = createMock({
      role: "admin",
      targetRow: {
        id: ANN_ID,
        title: "下書き",
        body_rich: validBody,
        notify_email: false,
        created_by_user_id: "u1",
        published_at: null,
        created_at: "2026-06-01T00:00:00.000Z",
      },
      users: [{ id: "u1", username: "幹部" }],
    });
    const app = buildApp(supabase);

    const res = await request(app, `/api/announcements/${ANN_ID}`, {
      method: "GET",
    });

    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({
      success: true,
      data: { isDraft: true },
    });
  });
});

describe("POST /api/announcements/:id/publish", () => {
  it("下書きを公開できる", async () => {
    const { supabase } = createMock({
      role: "admin",
      targetRow: { published_at: null },
    });
    const app = buildApp(supabase);

    const res = await request(app, `/api/announcements/${ANN_ID}/publish`, {
      method: "POST",
    });

    expect(res.status).toBe(200);
  });

  it("既に公開済みなら 400", async () => {
    const { supabase } = createMock({
      role: "admin",
      targetRow: { published_at: "2026-06-01T00:00:00.000Z" },
    });
    const app = buildApp(supabase);

    const res = await request(app, `/api/announcements/${ANN_ID}/publish`, {
      method: "POST",
    });

    expect(res.status).toBe(400);
  });
});

describe("PUT /api/announcements/:id/read", () => {
  it("公開済みは既読にできる", async () => {
    const { supabase } = createMock({
      role: "member",
      targetRow: { published_at: "2026-06-01T00:00:00.000Z" },
    });
    const app = buildApp(supabase);

    const res = await request(app, `/api/announcements/${ANN_ID}/read`, {
      method: "PUT",
    });

    expect(res.status).toBe(200);
  });

  it("下書きは既読にできない(400)", async () => {
    const { supabase } = createMock({
      role: "member",
      targetRow: { published_at: null },
    });
    const app = buildApp(supabase);

    const res = await request(app, `/api/announcements/${ANN_ID}/read`, {
      method: "PUT",
    });

    expect(res.status).toBe(400);
  });
});

describe("DELETE /api/announcements/:id", () => {
  it("admin は削除できる", async () => {
    const { supabase } = createMock({ role: "admin" });
    const app = buildApp(supabase);

    const res = await request(app, `/api/announcements/${ANN_ID}`, {
      method: "DELETE",
    });

    expect(res.status).toBe(200);
  });

  it("member は削除できない(403)", async () => {
    const { supabase } = createMock({ role: "member" });
    const app = buildApp(supabase);

    const res = await request(app, `/api/announcements/${ANN_ID}`, {
      method: "DELETE",
    });

    expect(res.status).toBe(403);
  });
});
