import type { SupabaseClient } from "@supabase/supabase-js";
import { Hono } from "hono";
import { sign } from "hono/jwt";
import { describe, expect, it } from "vitest";
import boardPostsRoute from "./index.js";

const SECRET = "test-secret-token-with-at-least-32-characters";
const BOARD_ID = "00000000-0000-0000-0000-0000000000aa";
const POST_ID = "00000000-0000-0000-0000-0000000000bb";
const OTHER_POST_ID = "00000000-0000-0000-0000-0000000000cc";

type Role = "owner" | "admin" | "member" | null;

// board-posts route + boardAccess ミドルウェアが使う supabase 呼び出しを満たすスタブ。
function createMock(opts: {
  role?: Role;
  resolvedBoardId?: string | null;
  // GET /:id が返す投稿行。
  postRow?: Record<string, unknown> | null;
  // DELETE が author 判定に使う行(author_user_id を持つ)。
  authorRow?: Record<string, unknown> | null;
  listRows?: Record<string, unknown>[];
  listCount?: number;
  attachmentRows?: Record<string, unknown>[];
  threadRows?: { post_id: string }[];
  users?: { id: string; username: string; profile_image_url: string | null }[];
  insertResult?: { data: { id: string } | null; error: unknown };
  attachInsertError?: unknown;
}) {
  const role: Role = opts.role === undefined ? "member" : opts.role;
  const resolvedBoardId =
    opts.resolvedBoardId === undefined ? BOARD_ID : opts.resolvedBoardId;

  const boardPostsResolver = (state: ChainState) => {
    if (state.op === "insert") {
      return opts.insertResult ?? { data: { id: POST_ID }, error: null };
    }
    if (state.op === "delete") {
      return { error: null };
    }
    // ミドルウェア: select("board_id").eq("id").maybeSingle()
    if (state.columns === "board_id" && state.single) {
      return {
        data: resolvedBoardId ? { board_id: resolvedBoardId } : null,
        error: null,
      };
    }
    // DELETE の author 判定: select("author_user_id").eq("id").maybeSingle()
    if (state.columns === "author_user_id" && state.single) {
      return { data: opts.authorRow ?? null, error: null };
    }
    // GET /:id: 単一行
    if (state.single) {
      return { data: opts.postRow ?? null, error: null };
    }
    // 一覧(await)
    return {
      data: opts.listRows ?? [],
      error: null,
      count: opts.listCount ?? opts.listRows?.length ?? 0,
    };
  };

  const attachmentsResolver = (state: ChainState) => {
    if (state.op === "insert") {
      return { error: opts.attachInsertError ?? null };
    }
    return { data: opts.attachmentRows ?? [], error: null };
  };

  const aikiboard = {
    from: (table: string) => {
      if (table === "board_members") {
        return makeChain(() => ({
          data: role ? { role } : null,
          error: null,
        }));
      }
      if (table === "board_posts") {
        return makeChain(boardPostsResolver);
      }
      if (table === "board_post_attachments") {
        return makeChain(attachmentsResolver);
      }
      if (table === "threads") {
        return makeChain(() => ({ data: opts.threadRows ?? [], error: null }));
      }
      return makeChain(() => ({ data: [], error: null }));
    },
  };

  const storage = {
    from: () => ({
      createSignedUploadUrl: async (path: string) => ({
        data: { path, token: "signed-token", signedUrl: "https://x/upload" },
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
  app.route("/api/board-posts", boardPostsRoute);
  return app;
}

async function request(
  app: Hono<TestEnv>,
  path: string,
  init: { method: string; body?: unknown; auth?: boolean; sub?: string },
) {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (init.auth !== false) {
    const token = await sign({ sub: init.sub ?? "user-1" }, SECRET);
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

describe("POST /api/board-posts/upload-url", () => {
  it("メンバーは署名付きアップロード URL を取得できる", async () => {
    const { supabase } = createMock({ role: "member" });
    const app = buildApp(supabase);

    const res = await request(app, "/api/board-posts/upload-url", {
      method: "POST",
      body: { boardId: BOARD_ID, contentType: "image/png" },
    });

    expect(res.status).toBe(200);
    const json = (await res.json()) as {
      data: { path: string; attachmentType: string };
    };
    expect(json.data.attachmentType).toBe("image");
    expect(json.data.path).toMatch(new RegExp(`^feed/${BOARD_ID}/`));
  });

  it("非対応の形式は 400", async () => {
    const { supabase } = createMock({ role: "member" });
    const app = buildApp(supabase);

    const res = await request(app, "/api/board-posts/upload-url", {
      method: "POST",
      body: { boardId: BOARD_ID, contentType: "application/pdf" },
    });

    expect(res.status).toBe(400);
  });

  it("非メンバーは 404", async () => {
    const { supabase } = createMock({ role: null });
    const app = buildApp(supabase);

    const res = await request(app, "/api/board-posts/upload-url", {
      method: "POST",
      body: { boardId: BOARD_ID, contentType: "image/png" },
    });

    expect(res.status).toBe(404);
  });
});

describe("POST /api/board-posts", () => {
  it("メンバーはテキスト投稿できる", async () => {
    const { supabase } = createMock({ role: "member" });
    const app = buildApp(supabase);

    const res = await request(app, "/api/board-posts", {
      method: "POST",
      body: { boardId: BOARD_ID, body: "稽古お疲れさまでした" },
    });

    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({
      success: true,
      data: { id: POST_ID },
    });
  });

  it("本文も添付も無ければ 400", async () => {
    const { supabase } = createMock({ role: "member" });
    const app = buildApp(supabase);

    const res = await request(app, "/api/board-posts", {
      method: "POST",
      body: { boardId: BOARD_ID, body: "   " },
    });

    expect(res.status).toBe(400);
  });

  it("ボード外の添付パスは 400", async () => {
    const { supabase } = createMock({ role: "member" });
    const app = buildApp(supabase);

    const res = await request(app, "/api/board-posts", {
      method: "POST",
      body: {
        boardId: BOARD_ID,
        body: "",
        attachments: [
          {
            path: "feed/00000000-0000-0000-0000-0000000000ff/x.png",
            attachmentType: "image",
          },
        ],
      },
    });

    expect(res.status).toBe(400);
  });

  it("認証が無ければ 401", async () => {
    const { supabase } = createMock({ role: "member" });
    const app = buildApp(supabase);

    const res = await request(app, "/api/board-posts", {
      method: "POST",
      body: { boardId: BOARD_ID, body: "x" },
      auth: false,
    });

    expect(res.status).toBe(401);
  });
});

describe("GET /api/board-posts", () => {
  it("著者名・返信数つきで一覧を返す", async () => {
    const { supabase } = createMock({
      role: "member",
      listRows: [
        {
          id: POST_ID,
          body: "本日の稽古",
          author_user_id: "u1",
          cross_post_to_aikinote: false,
          synced_from_post_id: null,
          created_at: "2026-06-01T00:00:00.000Z",
        },
      ],
      listCount: 1,
      threadRows: [{ post_id: POST_ID }, { post_id: POST_ID }],
      users: [{ id: "u1", username: "道場長", profile_image_url: null }],
    });
    const app = buildApp(supabase);

    const res = await request(app, `/api/board-posts?boardId=${BOARD_ID}`, {
      method: "GET",
    });

    expect(res.status).toBe(200);
    const json = (await res.json()) as {
      data: {
        items: {
          author: { username: string };
          replyCount: number;
          canDelete: boolean;
        }[];
        total: number;
      };
    };
    expect(json.data.total).toBe(1);
    expect(json.data.items[0].author.username).toBe("道場長");
    expect(json.data.items[0].replyCount).toBe(2);
  });
});

describe("DELETE /api/board-posts/:id", () => {
  it("投稿者本人は削除できる", async () => {
    const { supabase } = createMock({
      role: "member",
      authorRow: { author_user_id: "user-1" },
    });
    const app = buildApp(supabase);

    const res = await request(app, `/api/board-posts/${POST_ID}`, {
      method: "DELETE",
      sub: "user-1",
    });

    expect(res.status).toBe(200);
  });

  it("他人の投稿は一般メンバーには削除させない(403)", async () => {
    const { supabase } = createMock({
      role: "member",
      authorRow: { author_user_id: "someone-else" },
    });
    const app = buildApp(supabase);

    const res = await request(app, `/api/board-posts/${OTHER_POST_ID}`, {
      method: "DELETE",
      sub: "user-1",
    });

    expect(res.status).toBe(403);
  });

  it("admin は他人の投稿も削除できる", async () => {
    const { supabase } = createMock({
      role: "admin",
      authorRow: { author_user_id: "someone-else" },
    });
    const app = buildApp(supabase);

    const res = await request(app, `/api/board-posts/${OTHER_POST_ID}`, {
      method: "DELETE",
      sub: "user-1",
    });

    expect(res.status).toBe(200);
  });
});
