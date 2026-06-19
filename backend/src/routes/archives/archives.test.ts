import type { SupabaseClient } from "@supabase/supabase-js";
import { Hono } from "hono";
import { sign } from "hono/jwt";
import { describe, expect, it } from "vitest";
import archivesRoute from "./index.js";

const SECRET = "test-secret-token-with-at-least-32-characters";
const BOARD_ID = "00000000-0000-0000-0000-0000000000aa";
const ARCHIVE_ID = "00000000-0000-0000-0000-0000000000bb";

type Role = "owner" | "admin" | "member" | null;

const validBody = {
  type: "doc",
  content: [{ type: "paragraph", content: [{ type: "text", text: "本文" }] }],
};

function createMock(opts: {
  role?: Role;
  featureCodes?: string[];
  resolvedBoardId?: string | null;
  listRows?: Record<string, unknown>[];
  searchRows?: Record<string, unknown>[];
  detailRow?: Record<string, unknown> | null;
  attachmentRows?: Record<string, unknown>[];
}) {
  const role: Role = opts.role === undefined ? "admin" : opts.role;
  const features = opts.featureCodes ?? ["archive"];
  const resolvedBoardId =
    opts.resolvedBoardId === undefined ? BOARD_ID : opts.resolvedBoardId;

  const archivesResolver = (s: ChainState) => {
    if (s.op === "insert") return { data: { id: ARCHIVE_ID }, error: null };
    if (s.op === "update" || s.op === "delete") return { error: null };
    if (s.columns.startsWith("board_id") && s.single) {
      return {
        data: resolvedBoardId ? { board_id: resolvedBoardId } : null,
        error: null,
      };
    }
    if (s.single) return { data: opts.detailRow ?? null, error: null };
    if (s.columns === "order_index") {
      return { data: [{ order_index: 2 }], error: null };
    }
    if (s.columns === "id, title, body_rich") {
      return { data: opts.searchRows ?? [], error: null };
    }
    return { data: opts.listRows ?? [], error: null };
  };

  const attachmentsResolver = (s: ChainState) => {
    if (s.op === "insert" || s.op === "delete") return { error: null };
    return { data: opts.attachmentRows ?? [], error: null };
  };

  const aikiboard = {
    from: (table: string) => {
      if (table === "board_members") {
        return makeChain(() => ({ data: role ? { role } : null, error: null }));
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
      if (table === "archives") return makeChain(archivesResolver);
      if (table === "archive_attachments")
        return makeChain(attachmentsResolver);
      return makeChain(() => ({ data: [], error: null }));
    },
  };

  const storage = {
    from: () => ({
      createSignedUploadUrl: async (path: string) => ({
        data: { path, token: "tok", signedUrl: "https://x/up" },
        error: null,
      }),
      createSignedUrls: async (paths: string[]) => ({
        data: paths.map((p) => ({ path: p, signedUrl: `https://x/${p}` })),
        error: null,
      }),
      remove: async () => ({ data: [], error: null }),
    }),
  };

  return {
    supabase: {
      schema: () => aikiboard,
      storage,
      from: () => makeChain(() => ({ data: [], error: null })),
    } as unknown as SupabaseClient,
  };
}

type ChainState = {
  columns: string;
  single: boolean;
  op: "insert" | "update" | "delete" | null;
};

function makeChain(resolver: (s: ChainState) => unknown) {
  const state: ChainState = { columns: "", single: false, op: null };
  const resolve = () => Promise.resolve(resolver(state));
  const chain: Record<string, unknown> = {
    select: (cols?: string) => {
      if (typeof cols === "string") state.columns = cols;
      return chain;
    },
    eq: () => chain,
    is: () => chain,
    in: () => chain,
    order: () => chain,
    range: () => chain,
    limit: () => chain,
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
      state.single = true;
      return resolve();
    },
    single: () => {
      state.single = true;
      return resolve();
    },
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
  app.route("/api/archives", archivesRoute);
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
    headers.Authorization = `Bearer ${await sign({ sub: "user-1" }, SECRET)}`;
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

describe("GET /api/archives", () => {
  it("メンバー + 機能ありでツリーを取得できる", async () => {
    const { supabase } = createMock({
      role: "member",
      listRows: [
        {
          id: ARCHIVE_ID,
          parent_id: null,
          title: "稽古記録",
          order_index: 0,
          created_at: "2026-06-01T00:00:00.000Z",
        },
      ],
    });
    const app = buildApp(supabase);

    const res = await request(app, `/api/archives?boardId=${BOARD_ID}`, {
      method: "GET",
    });

    expect(res.status).toBe(200);
    const json = (await res.json()) as { data: { title: string }[] };
    expect(json.data[0].title).toBe("稽古記録");
  });

  it("archive 機能が無いプランは 403(feature_locked)", async () => {
    const { supabase } = createMock({
      role: "member",
      featureCodes: ["calendar"],
    });
    const app = buildApp(supabase);

    const res = await request(app, `/api/archives?boardId=${BOARD_ID}`, {
      method: "GET",
    });

    expect(res.status).toBe(403);
    expect(await res.json()).toMatchObject({ code: "feature_locked" });
  });
});

describe("POST /api/archives", () => {
  it("admin はページを作成できる", async () => {
    const { supabase } = createMock({ role: "admin" });
    const app = buildApp(supabase);

    const res = await request(app, "/api/archives", {
      method: "POST",
      body: { boardId: BOARD_ID, title: "演武会2026", bodyRich: validBody },
    });

    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ data: { id: ARCHIVE_ID } });
  });

  it("member は作成できない(403)", async () => {
    const { supabase } = createMock({ role: "member" });
    const app = buildApp(supabase);

    const res = await request(app, "/api/archives", {
      method: "POST",
      body: { boardId: BOARD_ID, title: "x", bodyRich: validBody },
    });

    expect(res.status).toBe(403);
  });

  it("ボード外の添付は 400", async () => {
    const { supabase } = createMock({ role: "admin" });
    const app = buildApp(supabase);

    const res = await request(app, "/api/archives", {
      method: "POST",
      body: {
        boardId: BOARD_ID,
        title: "x",
        bodyRich: validBody,
        attachments: [
          {
            path: "archive/00000000-0000-0000-0000-0000000000ff/x.png",
            attachmentType: "image",
          },
        ],
      },
    });

    expect(res.status).toBe(400);
  });
});

describe("GET /api/archives/search", () => {
  it("タイトル/本文にマッチするページを返す", async () => {
    const { supabase } = createMock({
      role: "member",
      searchRows: [
        { id: ARCHIVE_ID, title: "夏合宿の記録", body_rich: validBody },
        { id: "x", title: "審査", body_rich: validBody },
      ],
    });
    const app = buildApp(supabase);

    const res = await request(
      app,
      `/api/archives/search?boardId=${BOARD_ID}&q=合宿`,
      { method: "GET" },
    );

    expect(res.status).toBe(200);
    const json = (await res.json()) as { data: { title: string }[] };
    expect(json.data).toHaveLength(1);
    expect(json.data[0].title).toBe("夏合宿の記録");
  });
});

describe("GET /api/archives/:id", () => {
  it("詳細を添付つきで返す", async () => {
    const { supabase } = createMock({
      role: "member",
      detailRow: {
        id: ARCHIVE_ID,
        parent_id: null,
        title: "稽古記録",
        body_rich: validBody,
        created_at: "2026-06-01T00:00:00.000Z",
      },
      attachmentRows: [
        {
          id: "att1",
          archive_id: ARCHIVE_ID,
          attachment_type: "image",
          url: "archive/board/x.png",
          metadata: {},
          order_index: 0,
        },
      ],
    });
    const app = buildApp(supabase);

    const res = await request(app, `/api/archives/${ARCHIVE_ID}`, {
      method: "GET",
    });

    expect(res.status).toBe(200);
    const json = (await res.json()) as {
      data: { title: string; attachments: { url: string }[] };
    };
    expect(json.data.title).toBe("稽古記録");
    expect(json.data.attachments[0].url).toContain("https://x/");
  });
});

describe("DELETE /api/archives/:id", () => {
  it("admin は削除できる", async () => {
    const { supabase } = createMock({ role: "admin" });
    const app = buildApp(supabase);

    const res = await request(app, `/api/archives/${ARCHIVE_ID}`, {
      method: "DELETE",
    });

    expect(res.status).toBe(200);
  });
});
