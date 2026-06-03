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
// - from("DojoStyleMaster")             : select/in(道場存在チェック)
function createSupabaseMock(opts: {
  slugCheck?: Result;
  dojoCheck?: Result;
  boardInsert?: Result;
  memberInsert?: { error: unknown };
  settingsInsert?: { error: unknown };
  dojoLinkInsert?: { error: unknown };
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
});
