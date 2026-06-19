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
  threadRows?: Record<string, unknown>[];
  // DELETE /:id/threads/:threadId が引く返信行(author_user_id, post_id)。
  threadRow?: Record<string, unknown> | null;
  users?: { id: string; username: string; profile_image_url: string | null }[];
  insertResult?: { data: { id: string } | null; error: unknown };
  threadInsertResult?: { data: { id: string } | null; error: unknown };
  attachInsertError?: unknown;
  // AikiNote 連携: 引用 post の所有者(isOwnAikinotePost 用)と一覧。
  aikinoteOwnerId?: string | null;
  aikinotePosts?: Record<string, unknown>[];
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
        return makeChain((state: ChainState) => {
          if (state.op === "insert") {
            return (
              opts.threadInsertResult ?? { data: { id: "t1" }, error: null }
            );
          }
          if (state.op === "delete") {
            return { error: null };
          }
          // DELETE の author/post 判定: select("author_user_id, post_id").maybeSingle()
          if (state.single) {
            return { data: opts.threadRow ?? null, error: null };
          }
          return { data: opts.threadRows ?? [], error: null };
        });
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

  const socialPostResolver = (state: ChainState) => {
    if (state.op === "insert") {
      return { data: { id: "sp1" }, error: null };
    }
    // isOwnAikinotePost: select("user_id, is_deleted").eq("id").maybeSingle()
    if (state.single) {
      if (opts.aikinoteOwnerId === undefined || opts.aikinoteOwnerId === null) {
        return { data: null, error: null };
      }
      return {
        data: { user_id: opts.aikinoteOwnerId, is_deleted: false },
        error: null,
      };
    }
    // listOwnAikinotePosts / resolveQuotedPosts(await)
    return { data: opts.aikinotePosts ?? [], error: null };
  };

  return {
    supabase: {
      schema: () => aikiboard,
      storage,
      from: (table: string) => {
        if (table === "User") {
          return makeChain(() => ({ data: opts.users ?? [], error: null }));
        }
        if (table === "SocialPost") {
          return makeChain(socialPostResolver);
        }
        return makeChain(() => ({ data: [], error: null }));
      },
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
    limit: () => chain,
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

describe("GET /api/board-posts/:id/threads", () => {
  it("返信を著者名つき・古い順で返す", async () => {
    const { supabase } = createMock({
      role: "member",
      threadRows: [
        {
          id: "t1",
          author_user_id: "u1",
          body: "ありがとうございます",
          created_at: "2026-06-01T00:00:00.000Z",
        },
      ],
      users: [{ id: "u1", username: "門人", profile_image_url: null }],
    });
    const app = buildApp(supabase);

    const res = await request(app, `/api/board-posts/${POST_ID}/threads`, {
      method: "GET",
    });

    expect(res.status).toBe(200);
    const json = (await res.json()) as {
      data: { author: { username: string }; canDelete: boolean }[];
    };
    expect(json.data[0].author.username).toBe("門人");
  });
});

describe("POST /api/board-posts/:id/threads", () => {
  it("メンバーは返信できる", async () => {
    const { supabase } = createMock({ role: "member" });
    const app = buildApp(supabase);

    const res = await request(app, `/api/board-posts/${POST_ID}/threads`, {
      method: "POST",
      body: { body: "お疲れさまでした" },
    });

    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ success: true });
  });

  it("空の返信は 400", async () => {
    const { supabase } = createMock({ role: "member" });
    const app = buildApp(supabase);

    const res = await request(app, `/api/board-posts/${POST_ID}/threads`, {
      method: "POST",
      body: { body: "" },
    });

    expect(res.status).toBe(400);
  });
});

describe("DELETE /api/board-posts/:id/threads/:threadId", () => {
  it("返信者本人は削除できる", async () => {
    const { supabase } = createMock({
      role: "member",
      threadRow: { author_user_id: "user-1", post_id: POST_ID },
    });
    const app = buildApp(supabase);

    const res = await request(app, `/api/board-posts/${POST_ID}/threads/t1`, {
      method: "DELETE",
      sub: "user-1",
    });

    expect(res.status).toBe(200);
  });

  it("他人の返信は一般メンバーには削除させない(403)", async () => {
    const { supabase } = createMock({
      role: "member",
      threadRow: { author_user_id: "someone-else", post_id: POST_ID },
    });
    const app = buildApp(supabase);

    const res = await request(app, `/api/board-posts/${POST_ID}/threads/t1`, {
      method: "DELETE",
      sub: "user-1",
    });

    expect(res.status).toBe(403);
  });

  it("別投稿の返信 id を渡すと 404(越境防止)", async () => {
    const { supabase } = createMock({
      role: "admin",
      threadRow: { author_user_id: "user-1", post_id: "other-post" },
    });
    const app = buildApp(supabase);

    const res = await request(app, `/api/board-posts/${POST_ID}/threads/t1`, {
      method: "DELETE",
      sub: "user-1",
    });

    expect(res.status).toBe(404);
  });
});

describe("AikiNote 連携(引用・クロスポスト)", () => {
  const QUOTE_ID = "00000000-0000-0000-0000-0000000000d1";

  it("AikiNote にも流す(クロスポスト)つきで投稿できる", async () => {
    const { supabase } = createMock({ role: "member" });
    const app = buildApp(supabase);

    const res = await request(app, "/api/board-posts", {
      method: "POST",
      body: {
        boardId: BOARD_ID,
        body: "稽古日誌をシェアします",
        crossPostToAikinote: true,
      },
      sub: "user-1",
    });

    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ success: true });
  });

  it("本人の AikiNote 投稿は引用できる", async () => {
    const { supabase } = createMock({
      role: "member",
      aikinoteOwnerId: "user-1",
    });
    const app = buildApp(supabase);

    const res = await request(app, "/api/board-posts", {
      method: "POST",
      body: { boardId: BOARD_ID, body: "引用です", syncedFromPostId: QUOTE_ID },
      sub: "user-1",
    });

    expect(res.status).toBe(200);
  });

  it("他人の AikiNote 投稿は引用できない(400)", async () => {
    const { supabase } = createMock({
      role: "member",
      aikinoteOwnerId: "someone-else",
    });
    const app = buildApp(supabase);

    const res = await request(app, "/api/board-posts", {
      method: "POST",
      body: { boardId: BOARD_ID, body: "引用です", syncedFromPostId: QUOTE_ID },
      sub: "user-1",
    });

    expect(res.status).toBe(400);
  });

  it("GET /aikinote-posts は本人の投稿を返す", async () => {
    const { supabase } = createMock({
      role: "member",
      aikinotePosts: [
        {
          id: QUOTE_ID,
          content: "今日の稽古メモ",
          post_type: "training_record",
          visibility: "public",
          created_at: "2026-06-01T00:00:00.000Z",
        },
      ],
    });
    const app = buildApp(supabase);

    const res = await request(
      app,
      `/api/board-posts/aikinote-posts?boardId=${BOARD_ID}`,
      { method: "GET", sub: "user-1" },
    );

    expect(res.status).toBe(200);
    const json = (await res.json()) as { data: { content: string }[] };
    expect(json.data[0].content).toBe("今日の稽古メモ");
  });
});
