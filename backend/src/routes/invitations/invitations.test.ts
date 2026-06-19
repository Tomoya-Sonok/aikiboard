import type { SupabaseClient } from "@supabase/supabase-js";
import { Hono } from "hono";
import { sign } from "hono/jwt";
import { describe, expect, it } from "vitest";
import invitationsRoute from "./index.js";

const SECRET = "test-secret-token-with-at-least-32-characters";
const BOARD_ID = "00000000-0000-0000-0000-0000000000aa";
const INV_ID = "00000000-0000-0000-0000-0000000000bb";
const ACTOR = "user-1";

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
    in: () => chain,
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
  membershipRole?: Role; // actor の board ロール(admin 系)or 既存メンバー(token 系)
  invitation?: {
    board_id: string;
    expires_at: string;
    revoked_at: string | null;
  } | null; // resolveInvitation / middleware 用
  invitationList?: unknown[];
}) {
  const membershipRole =
    opts.membershipRole === undefined ? "admin" : opts.membershipRole;
  const invitation =
    opts.invitation === undefined
      ? {
          board_id: BOARD_ID,
          expires_at: new Date(Date.now() + 86_400_000).toISOString(),
          revoked_at: null,
        }
      : opts.invitation;

  const invitationsResolver = (s: ChainState) => {
    if (s.op === "insert") {
      return {
        data: {
          id: INV_ID,
          token: "tok-123",
          expires_at: invitation?.expires_at ?? "",
          label: null,
          created_at: "2026-06-01T00:00:00Z",
        },
        error: null,
      };
    }
    if (s.op === "update") return { error: null };
    if (s.single && s.columns === "board_id") {
      // invitationAdminMiddleware の board 解決
      return {
        data: invitation ? { board_id: invitation.board_id } : null,
        error: null,
      };
    }
    if (s.single) {
      // resolveInvitation
      return { data: invitation, error: null };
    }
    return { data: opts.invitationList ?? [], error: null };
  };

  const boardMembersResolver = (s: ChainState) => {
    if (s.op === "insert") return { error: null };
    if (s.single && s.columns === "role") {
      return {
        data: membershipRole ? { role: membershipRole } : null,
        error: null,
      };
    }
    return { data: [], error: null }; // members list
  };

  const aikiboard = {
    from: (table: string) => {
      if (table === "invitations") return makeChain(invitationsResolver);
      if (table === "board_members") return makeChain(boardMembersResolver);
      if (table === "boards") {
        return makeChain(() => ({
          data: { name: "蕨合気道会", slug: "warabi" },
          error: null,
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
  app.route("/api/invitations", invitationsRoute);
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

describe("POST /api/invitations", () => {
  it("admin は招待リンクを発行できる", async () => {
    const { supabase } = createMock({ membershipRole: "admin" });
    const app = buildApp(supabase);

    const res = await request(app, "/api/invitations", {
      method: "POST",
      body: { boardId: BOARD_ID },
    });

    expect(res.status).toBe(200);
    const json = (await res.json()) as { data: { token: string } };
    expect(json.data.token).toBe("tok-123");
  });

  it("member は発行できない(403)", async () => {
    const { supabase } = createMock({ membershipRole: "member" });
    const app = buildApp(supabase);

    const res = await request(app, "/api/invitations", {
      method: "POST",
      body: { boardId: BOARD_ID },
    });

    expect(res.status).toBe(403);
  });
});

describe("GET /api/invitations", () => {
  it("admin は有効な招待一覧を取得できる", async () => {
    const { supabase } = createMock({
      membershipRole: "admin",
      invitationList: [
        {
          id: INV_ID,
          token: "tok-123",
          expires_at: new Date(Date.now() + 86_400_000).toISOString(),
          label: null,
          created_at: "2026-06-01T00:00:00Z",
        },
      ],
    });
    const app = buildApp(supabase);

    const res = await request(app, `/api/invitations?boardId=${BOARD_ID}`, {
      method: "GET",
    });

    expect(res.status).toBe(200);
  });
});

describe("POST /api/invitations/:id/revoke", () => {
  it("admin は招待を失効できる", async () => {
    const { supabase } = createMock({ membershipRole: "admin" });
    const app = buildApp(supabase);

    const res = await request(app, `/api/invitations/${INV_ID}/revoke`, {
      method: "POST",
    });

    expect(res.status).toBe(200);
  });
});

describe("GET /api/invitations/token/:token", () => {
  it("有効な招待はプレビューを返す", async () => {
    const { supabase } = createMock({ membershipRole: null });
    const app = buildApp(supabase);

    const res = await request(app, "/api/invitations/token/tok-123", {
      method: "GET",
    });

    expect(res.status).toBe(200);
    const json = (await res.json()) as {
      data: { boardSlug: string; alreadyMember: boolean };
    };
    expect(json.data.boardSlug).toBe("warabi");
    expect(json.data.alreadyMember).toBe(false);
  });

  it("失効済みの招待は 404", async () => {
    const { supabase } = createMock({
      membershipRole: null,
      invitation: {
        board_id: BOARD_ID,
        expires_at: new Date(Date.now() + 86_400_000).toISOString(),
        revoked_at: new Date().toISOString(),
      },
    });
    const app = buildApp(supabase);

    const res = await request(app, "/api/invitations/token/tok-123", {
      method: "GET",
    });

    expect(res.status).toBe(404);
  });
});

describe("POST /api/invitations/token/:token/join", () => {
  it("非メンバーは招待で参加できる", async () => {
    const { supabase } = createMock({ membershipRole: null });
    const app = buildApp(supabase);

    const res = await request(app, "/api/invitations/token/tok-123/join", {
      method: "POST",
    });

    expect(res.status).toBe(200);
    const json = (await res.json()) as { data: { alreadyMember: boolean } };
    expect(json.data.alreadyMember).toBe(false);
  });

  it("既にメンバーなら冪等に成功する", async () => {
    const { supabase } = createMock({ membershipRole: "member" });
    const app = buildApp(supabase);

    const res = await request(app, "/api/invitations/token/tok-123/join", {
      method: "POST",
    });

    expect(res.status).toBe(200);
    const json = (await res.json()) as { data: { alreadyMember: boolean } };
    expect(json.data.alreadyMember).toBe(true);
  });
});
