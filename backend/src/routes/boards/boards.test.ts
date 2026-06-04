import type { SupabaseClient } from "@supabase/supabase-js";
import { Hono } from "hono";
import { sign } from "hono/jwt";
import { describe, expect, it, vi } from "vitest";
import boardsRoute from "./index.js";

const SECRET = "test-secret-token-with-at-least-32-characters";
const DOJO_ID = "00000000-0000-0000-0000-000000000001";

type Result = { data: unknown; error: unknown };

// boards route が使う supabase 呼び出しだけを満たすスタブ。
// - schema("aikiboard").from("boards")  : select/eq/maybeSingle(slug 確認), insert/select/single(作成), delete/eq(ロールバック)
// - schema("aikiboard").from("board_members"|"board_settings"|"board_dojo_masters") : insert(終端)
// - schema("aikiboard").from("plans")               : select/eq/maybeSingle(free プラン取得)
// - schema("aikiboard").from("board_subscriptions") : insert(終端)
// - from("DojoStyleMaster")             : select/in(道場存在チェック)
function createSupabaseMock(opts: {
  slugCheck?: Result;
  dojoCheck?: Result;
  boardInsert?: Result;
  memberInsert?: { error: unknown };
  settingsInsert?: { error: unknown };
  dojoLinkInsert?: { error: unknown };
  planCheck?: Result;
  subInsert?: { error: unknown };
}) {
  const deleteSpy = vi.fn(() => ({
    eq: async () => ({ error: null }),
  }));

  const boardsBuilder = {
    select: () => ({
      eq: () => ({
        maybeSingle: async () => opts.slugCheck ?? { data: null, error: null },
      }),
    }),
    insert: () => ({
      select: () => ({
        single: async () =>
          opts.boardInsert ?? {
            data: {
              id: "board-1",
              name: "一般稽古",
              slug: "general",
              is_public: true,
            },
            error: null,
          },
      }),
    }),
    delete: deleteSpy,
  };

  const aikiboard = {
    from: (table: string) => {
      if (table === "boards") {
        return boardsBuilder;
      }
      if (table === "board_members") {
        return { insert: async () => opts.memberInsert ?? { error: null } };
      }
      if (table === "board_settings") {
        return { insert: async () => opts.settingsInsert ?? { error: null } };
      }
      if (table === "plans") {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () =>
                opts.planCheck ?? { data: { id: "plan-free" }, error: null },
            }),
          }),
        };
      }
      if (table === "board_subscriptions") {
        return { insert: async () => opts.subInsert ?? { error: null } };
      }
      return { insert: async () => opts.dojoLinkInsert ?? { error: null } };
    },
  };

  const supabase = {
    schema: () => aikiboard,
    from: () => ({
      select: () => ({
        in: async () =>
          opts.dojoCheck ?? { data: [{ id: DOJO_ID }], error: null },
      }),
    }),
  };

  return {
    supabase: supabase as unknown as SupabaseClient,
    deleteSpy,
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
  app.route("/api/boards", boardsRoute);
  return app;
}

async function postBoard(app: Hono<TestEnv>, body: unknown) {
  const token = await sign({ sub: "user-1" }, SECRET);
  return app.request(
    "/api/boards",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body),
    },
    { SUPABASE_JWT_SECRET: SECRET },
  );
}

const validBody = {
  name: "一般稽古",
  slug: "warabi-general",
  isPublic: true,
  dojoMasterIds: [DOJO_ID],
};

describe("POST /api/boards", () => {
  it("ボードを作成し関連行を作る", async () => {
    // Arrange
    const { supabase } = createSupabaseMock({});
    const app = buildApp(supabase);

    // Act
    const res = await postBoard(app, validBody);

    // Assert
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({
      success: true,
      data: { id: "board-1", slug: "general" },
    });
  });

  it("slug が重複していたら 409 を返す", async () => {
    // Arrange
    const { supabase } = createSupabaseMock({
      slugCheck: { data: { id: "existing" }, error: null },
    });
    const app = buildApp(supabase);

    // Act
    const res = await postBoard(app, validBody);

    // Assert
    expect(res.status).toBe(409);
  });

  it("入力が不正なら 400 を返す", async () => {
    // Arrange
    const { supabase } = createSupabaseMock({});
    const app = buildApp(supabase);

    // Act(slug 不正・道場なし)
    const res = await postBoard(app, {
      name: "x",
      slug: "A_B",
      isPublic: true,
    });

    // Assert
    expect(res.status).toBe(400);
  });

  it("選択した道場が存在しなければ 400 を返す", async () => {
    // Arrange(道場チェックが空 = 不一致)
    const { supabase } = createSupabaseMock({
      dojoCheck: { data: [], error: null },
    });
    const app = buildApp(supabase);

    // Act
    const res = await postBoard(app, validBody);

    // Assert
    expect(res.status).toBe(400);
  });

  it("関連行の INSERT が失敗したら board を削除して 500 を返す", async () => {
    // Arrange(board_members の insert が失敗)
    const { supabase, deleteSpy } = createSupabaseMock({
      memberInsert: { error: { message: "insert failed" } },
    });
    const app = buildApp(supabase);

    // Act
    const res = await postBoard(app, validBody);

    // Assert
    expect(res.status).toBe(500);
    expect(deleteSpy).toHaveBeenCalled();
  });

  it("認証が無ければ 401 を返す", async () => {
    // Arrange
    const { supabase } = createSupabaseMock({});
    const app = buildApp(supabase);

    // Act(Authorization 無し)
    const res = await app.request(
      "/api/boards",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(validBody),
      },
      { SUPABASE_JWT_SECRET: SECRET },
    );

    // Assert
    expect(res.status).toBe(401);
  });

  it("Free プランが取得できなければ board を削除して 500 を返す", async () => {
    // Arrange(plans の取得が空)
    const { supabase, deleteSpy } = createSupabaseMock({
      planCheck: { data: null, error: null },
    });
    const app = buildApp(supabase);

    // Act
    const res = await postBoard(app, validBody);

    // Assert
    expect(res.status).toBe(500);
    expect(deleteSpy).toHaveBeenCalled();
  });

  it("board_subscriptions の INSERT が失敗したら board を削除して 500 を返す", async () => {
    // Arrange(サブスク insert が失敗)
    const { supabase, deleteSpy } = createSupabaseMock({
      subInsert: { error: { message: "insert failed" } },
    });
    const app = buildApp(supabase);

    // Act
    const res = await postBoard(app, validBody);

    // Assert
    expect(res.status).toBe(500);
    expect(deleteSpy).toHaveBeenCalled();
  });
});

// GET /api/boards 用スタブ。board_members は select().eq().order()(所属取得)と
// select().in()(メンバー数集計)の両方で呼ばれるため、両メソッドを生やす。
function createListSupabaseMock(opts: {
  memberships?: Result;
  boards?: Result;
  allMembers?: Result;
  subscriptions?: Result;
  plans?: Result;
}) {
  const aikiboard = {
    from: (table: string) => {
      if (table === "board_members") {
        return {
          select: () => ({
            eq: () => ({
              order: async () => opts.memberships ?? { data: [], error: null },
            }),
            in: async () => opts.allMembers ?? { data: [], error: null },
          }),
        };
      }
      if (table === "boards") {
        return {
          select: () => ({
            in: async () => opts.boards ?? { data: [], error: null },
          }),
        };
      }
      if (table === "board_subscriptions") {
        return {
          select: () => ({
            in: async () => opts.subscriptions ?? { data: [], error: null },
          }),
        };
      }
      if (table === "plans") {
        return {
          select: () => ({
            in: async () => opts.plans ?? { data: [], error: null },
          }),
        };
      }
      return {};
    },
  };

  return {
    supabase: { schema: () => aikiboard } as unknown as SupabaseClient,
  };
}

async function getBoards(app: Hono<TestEnv>, withAuth = true) {
  const headers: Record<string, string> = {};
  if (withAuth) {
    const token = await sign({ sub: "user-1" }, SECRET);
    headers.Authorization = `Bearer ${token}`;
  }
  return app.request(
    "/api/boards",
    { method: "GET", headers },
    { SUPABASE_JWT_SECRET: SECRET },
  );
}

describe("GET /api/boards", () => {
  it("所属ボードを role / プラン / メンバー数つきで返す", async () => {
    // Arrange
    const { supabase } = createListSupabaseMock({
      memberships: {
        data: [{ board_id: "b1", role: "owner", joined_at: "2026-01-01" }],
        error: null,
      },
      boards: {
        data: [
          { id: "b1", name: "蕨合気道会", slug: "warabi", is_public: true },
        ],
        error: null,
      },
      allMembers: {
        data: [{ board_id: "b1" }, { board_id: "b1" }, { board_id: "b1" }],
        error: null,
      },
      subscriptions: {
        data: [{ board_id: "b1", plan_id: "plan-std" }],
        error: null,
      },
      plans: {
        data: [{ id: "plan-std", code: "standard", name: "Standard" }],
        error: null,
      },
    });
    const app = buildApp(supabase);

    // Act
    const res = await getBoards(app);

    // Assert
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({
      success: true,
      data: [
        {
          id: "b1",
          slug: "warabi",
          role: "owner",
          planCode: "standard",
          planName: "Standard",
          memberCount: 3,
        },
      ],
    });
  });

  it("サブスク未設定のボードは Free として返す", async () => {
    // Arrange(subscriptions が空)
    const { supabase } = createListSupabaseMock({
      memberships: {
        data: [{ board_id: "b1", role: "member", joined_at: "2026-01-01" }],
        error: null,
      },
      boards: {
        data: [
          { id: "b1", name: "養神館", slug: "yoshinkan", is_public: false },
        ],
        error: null,
      },
      allMembers: { data: [{ board_id: "b1" }], error: null },
      subscriptions: { data: [], error: null },
    });
    const app = buildApp(supabase);

    // Act
    const res = await getBoards(app);

    // Assert
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.data[0]).toMatchObject({
      planCode: "free",
      planName: "Free",
      memberCount: 1,
    });
  });

  it("所属ボードが無ければ空配列を返す", async () => {
    // Arrange
    const { supabase } = createListSupabaseMock({
      memberships: { data: [], error: null },
    });
    const app = buildApp(supabase);

    // Act
    const res = await getBoards(app);

    // Assert
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ success: true, data: [] });
  });

  it("認証が無ければ 401 を返す", async () => {
    // Arrange
    const { supabase } = createListSupabaseMock({});
    const app = buildApp(supabase);

    // Act
    const res = await getBoards(app, false);

    // Assert
    expect(res.status).toBe(401);
  });

  it("クエリが失敗したら 500 を返す", async () => {
    // Arrange(board_members の取得が失敗)
    const { supabase } = createListSupabaseMock({
      memberships: { data: null, error: { message: "boom" } },
    });
    const app = buildApp(supabase);

    // Act
    const res = await getBoards(app);

    // Assert
    expect(res.status).toBe(500);
  });
});
