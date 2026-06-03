import type { SupabaseClient } from "@supabase/supabase-js";
import { Hono } from "hono";
import { sign } from "hono/jwt";
import { describe, expect, it } from "vitest";
import usersRoute from "./index.js";

const SECRET = "test-secret-token-with-at-least-32-characters";

type QueryResult = { data: unknown; error: unknown };

// users route が使う Supabase 呼び出し
//   - from("User").select(..).eq(..).maybeSingle()  … selectResults から順に返す
//   - from("User").insert(..).select(..).single()    … insertResult を返す
//   - auth.admin.createUser / deleteUser
// だけを満たす最小スタブ。
function createSupabaseMock(
  opts: {
    selectResults?: QueryResult[];
    createUser?: { data: unknown; error: unknown };
    insertResult?: QueryResult;
  } = {},
): SupabaseClient {
  const selectQueue = [...(opts.selectResults ?? [])];
  const mock = {
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () =>
            selectQueue.shift() ?? { data: null, error: null },
        }),
      }),
      insert: () => ({
        select: () => ({
          single: async () => opts.insertResult ?? { data: null, error: null },
        }),
      }),
    }),
    auth: {
      admin: {
        createUser: async () =>
          opts.createUser ?? {
            data: { user: { id: "new-user-id" } },
            error: null,
          },
        deleteUser: async () => ({ data: null, error: null }),
      },
    },
  };
  return mock as unknown as SupabaseClient;
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
  app.route("/api/users", usersRoute);
  return app;
}

function postUser(app: Hono<TestEnv>, body: unknown) {
  return app.request("/api/users", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/users", () => {
  it("新規ユーザーを作成して返す", async () => {
    // Arrange
    const supabase = createSupabaseMock({
      selectResults: [
        { data: null, error: null },
        { data: null, error: null },
      ],
      insertResult: {
        data: {
          id: "new-user-id",
          email: "taro@example.com",
          username: "taro",
        },
        error: null,
      },
    });
    const app = buildApp(supabase);

    // Act
    const res = await postUser(app, {
      email: "taro@example.com",
      password: "Passw0rd!",
      username: "taro",
    });

    // Assert
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({
      success: true,
      data: { id: "new-user-id", username: "taro" },
    });
  });

  it("入力が不正なら 400 を返す", async () => {
    // Arrange
    const app = buildApp(createSupabaseMock());

    // Act
    const res = await postUser(app, { email: "not-an-email", password: "x" });

    // Assert
    expect(res.status).toBe(400);
  });

  it("既に登録済みの email なら 400 を返す", async () => {
    // Arrange
    const supabase = createSupabaseMock({
      selectResults: [{ data: { id: "existing" }, error: null }],
    });
    const app = buildApp(supabase);

    // Act
    const res = await postUser(app, {
      email: "taro@example.com",
      password: "Passw0rd!",
      username: "taro",
    });

    // Assert
    expect(res.status).toBe(400);
  });
});

describe("GET /api/users/:userId", () => {
  it("本人なら profile を返す", async () => {
    // Arrange
    const supabase = createSupabaseMock({
      selectResults: [
        {
          data: {
            id: "user-1",
            email: "taro@example.com",
            username: "taro",
            profile_image_url: null,
          },
          error: null,
        },
      ],
    });
    const app = buildApp(supabase);
    const token = await sign({ sub: "user-1" }, SECRET);

    // Act
    const res = await app.request(
      "/api/users/user-1",
      { headers: { Authorization: `Bearer ${token}` } },
      { SUPABASE_JWT_SECRET: SECRET },
    );

    // Assert
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({
      success: true,
      data: { id: "user-1", username: "taro" },
    });
  });

  it("他人の userId なら 403 を返す", async () => {
    // Arrange
    const app = buildApp(createSupabaseMock());
    const token = await sign({ sub: "user-1" }, SECRET);

    // Act
    const res = await app.request(
      "/api/users/user-2",
      { headers: { Authorization: `Bearer ${token}` } },
      { SUPABASE_JWT_SECRET: SECRET },
    );

    // Assert
    expect(res.status).toBe(403);
  });
});
