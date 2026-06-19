import type { SupabaseClient } from "@supabase/supabase-js";
import { Hono } from "hono";
import { sign } from "hono/jwt";
import { describe, expect, it } from "vitest";
import boardTodosRoute from "./index.js";

const SECRET = "test-secret-token-with-at-least-32-characters";
const BOARD_ID = "00000000-0000-0000-0000-0000000000aa";
const TODO_ID = "00000000-0000-0000-0000-0000000000bb";
const ASSIGNEE = "00000000-0000-0000-0000-0000000000cc";
const REQUESTER = "user-1";

type Role = "owner" | "admin" | "member" | null;

function createMock(opts: {
  role?: Role; // 閲覧者(REQUESTER)のロール
  assigneeRole?: Role; // 担当者候補のロール(担当者検証)
  resolvedBoardId?: string | null;
  todoRows?: Record<string, unknown>[];
  users?: { id: string; username: string; profile_image_url: string | null }[];
}) {
  const role: Role = opts.role === undefined ? "admin" : opts.role;
  const assigneeRole: Role =
    opts.assigneeRole === undefined ? "admin" : opts.assigneeRole;
  const resolvedBoardId =
    opts.resolvedBoardId === undefined ? BOARD_ID : opts.resolvedBoardId;

  const memberResolver = (s: ChainState) => {
    // 担当者候補一覧: select("user_id, role").in(...)
    if (s.columns.includes("user_id")) {
      return {
        data: [{ user_id: ASSIGNEE, role: "admin" }],
        error: null,
      };
    }
    // ロール確認(requester or assignee)。eq の user_id で判定。
    const target = s.eqUserId === REQUESTER ? role : assigneeRole;
    return { data: target ? { role: target } : null, error: null };
  };

  const todoResolver = (s: ChainState) => {
    if (s.op === "insert") return { data: { id: TODO_ID }, error: null };
    if (s.op === "update" || s.op === "delete") return { error: null };
    if (s.columns.startsWith("board_id") && s.single) {
      return {
        data: resolvedBoardId ? { board_id: resolvedBoardId } : null,
        error: null,
      };
    }
    return { data: opts.todoRows ?? [], error: null };
  };

  const aikiboard = {
    from: (table: string) => {
      if (table === "board_members") return makeChain(memberResolver);
      if (table === "board_todos") return makeChain(todoResolver);
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
  single: boolean;
  op: "insert" | "update" | "delete" | null;
  eqUserId: string | null;
};

function makeChain(resolver: (s: ChainState) => unknown) {
  const state: ChainState = {
    columns: "",
    single: false,
    op: null,
    eqUserId: null,
  };
  const resolve = () => Promise.resolve(resolver(state));
  const chain: Record<string, unknown> = {
    select: (cols?: string) => {
      if (typeof cols === "string") state.columns = cols;
      return chain;
    },
    eq: (col?: string, val?: unknown) => {
      if (col === "user_id" && typeof val === "string") state.eqUserId = val;
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
  app.route("/api/board-todos", boardTodosRoute);
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
    headers.Authorization = `Bearer ${await sign({ sub: REQUESTER }, SECRET)}`;
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

describe("GET /api/board-todos", () => {
  it("admin は一覧を取得できる(担当者名つき)", async () => {
    const { supabase } = createMock({
      role: "admin",
      todoRows: [
        {
          id: TODO_ID,
          title: "道場の鍵を返却",
          assignee_user_id: ASSIGNEE,
          note: null,
          status: "todo",
          due_date: null,
          created_at: "2026-06-01T00:00:00.000Z",
        },
      ],
      users: [{ id: ASSIGNEE, username: "幹部", profile_image_url: null }],
    });
    const app = buildApp(supabase);

    const res = await request(app, `/api/board-todos?boardId=${BOARD_ID}`, {
      method: "GET",
    });

    expect(res.status).toBe(200);
    const json = (await res.json()) as {
      data: { title: string; assignee: { username: string } }[];
    };
    expect(json.data[0].title).toBe("道場の鍵を返却");
    expect(json.data[0].assignee.username).toBe("幹部");
  });

  it("member は参照できない(403)", async () => {
    const { supabase } = createMock({ role: "member" });
    const app = buildApp(supabase);

    const res = await request(app, `/api/board-todos?boardId=${BOARD_ID}`, {
      method: "GET",
    });

    expect(res.status).toBe(403);
  });
});

describe("POST /api/board-todos", () => {
  it("admin は管理者を担当者に作成できる", async () => {
    const { supabase } = createMock({ role: "admin", assigneeRole: "admin" });
    const app = buildApp(supabase);

    const res = await request(app, "/api/board-todos", {
      method: "POST",
      body: {
        boardId: BOARD_ID,
        title: "備品の発注",
        assigneeUserId: ASSIGNEE,
      },
    });

    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ data: { id: TODO_ID } });
  });

  it("担当者が一般メンバーなら 400", async () => {
    const { supabase } = createMock({ role: "admin", assigneeRole: "member" });
    const app = buildApp(supabase);

    const res = await request(app, "/api/board-todos", {
      method: "POST",
      body: {
        boardId: BOARD_ID,
        title: "x",
        assigneeUserId: ASSIGNEE,
      },
    });

    expect(res.status).toBe(400);
  });

  it("20字を超えるタイトルは 400", async () => {
    const { supabase } = createMock({ role: "admin" });
    const app = buildApp(supabase);

    const res = await request(app, "/api/board-todos", {
      method: "POST",
      body: {
        boardId: BOARD_ID,
        title: "あ".repeat(21),
        assigneeUserId: ASSIGNEE,
      },
    });

    expect(res.status).toBe(400);
  });
});

describe("PATCH /api/board-todos/:id", () => {
  it("ステータスを更新できる", async () => {
    const { supabase } = createMock({ role: "admin" });
    const app = buildApp(supabase);

    const res = await request(app, `/api/board-todos/${TODO_ID}`, {
      method: "PATCH",
      body: { status: "done" },
    });

    expect(res.status).toBe(200);
  });
});

describe("DELETE /api/board-todos/:id", () => {
  it("admin は削除できる", async () => {
    const { supabase } = createMock({ role: "admin" });
    const app = buildApp(supabase);

    const res = await request(app, `/api/board-todos/${TODO_ID}`, {
      method: "DELETE",
    });

    expect(res.status).toBe(200);
  });

  it("member は削除できない(403)", async () => {
    const { supabase } = createMock({ role: "member" });
    const app = buildApp(supabase);

    const res = await request(app, `/api/board-todos/${TODO_ID}`, {
      method: "DELETE",
    });

    expect(res.status).toBe(403);
  });
});

describe("GET /api/board-todos/assignees", () => {
  it("owner/admin の担当者候補を返す", async () => {
    const { supabase } = createMock({
      role: "admin",
      users: [{ id: ASSIGNEE, username: "幹部", profile_image_url: null }],
    });
    const app = buildApp(supabase);

    const res = await request(
      app,
      `/api/board-todos/assignees?boardId=${BOARD_ID}`,
      { method: "GET" },
    );

    expect(res.status).toBe(200);
    const json = (await res.json()) as { data: { username: string }[] };
    expect(json.data[0].username).toBe("幹部");
  });
});
