import type { SupabaseClient } from "@supabase/supabase-js";
import { Hono } from "hono";
import { sign } from "hono/jwt";
import { describe, expect, it } from "vitest";
import dojoMastersRoute from "./index.js";

const SECRET = "test-secret-token-with-at-least-32-characters";

const SEED = [
  {
    id: "00000000-0000-0000-0000-000000000001",
    dojo_name: "合気会本部道場",
    dojo_name_kana: "あいきかいほんぶどうじょう",
  },
];

// from("DojoStyleMaster").select().eq().order().limit().or() を満たす thenable スタブ。
function createSupabaseMock(result: {
  data: unknown;
  error: unknown;
}): SupabaseClient {
  const builder = {
    select: () => builder,
    eq: () => builder,
    order: () => builder,
    limit: () => builder,
    or: () => builder,
    // biome-ignore lint/suspicious/noThenProperty: PostgREST のクエリビルダ(await 可能)を模した thenable スタブ
    then: (resolve: (value: { data: unknown; error: unknown }) => void) =>
      resolve(result),
  };
  return { from: () => builder } as unknown as SupabaseClient;
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
  app.route("/api/dojo-masters", dojoMastersRoute);
  return app;
}

async function getDojos(app: Hono<TestEnv>, query: string) {
  const token = await sign({ sub: "user-1" }, SECRET);
  return app.request(
    `/api/dojo-masters${query}`,
    { headers: { Authorization: `Bearer ${token}` } },
    { SUPABASE_JWT_SECRET: SECRET },
  );
}

// POST(新規追加)用: 重複チェック(maybeSingle)+ insert(single)を切り替える thenable スタブ。
function createWriteMock(opts: {
  existing?: Record<string, unknown> | null;
  inserted?: Record<string, unknown>;
}): SupabaseClient {
  const makeBuilder = () => {
    const state = { op: "select" as "select" | "insert" };
    const builder: Record<string, unknown> = {
      select: () => builder,
      eq: () => builder,
      ilike: () => builder,
      order: () => builder,
      limit: () => builder,
      or: () => builder,
      insert: () => {
        state.op = "insert";
        return builder;
      },
      maybeSingle: () =>
        Promise.resolve({ data: opts.existing ?? null, error: null }),
      single: () =>
        Promise.resolve({
          data: opts.inserted ?? {
            id: "00000000-0000-0000-0000-0000000000ff",
            dojo_name: "新道場",
            dojo_name_kana: null,
            is_approved: false,
          },
          error: null,
        }),
    };
    return builder;
  };
  return { from: () => makeBuilder() } as unknown as SupabaseClient;
}

async function postDojo(app: Hono<TestEnv>, body: unknown, auth = true) {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (auth) {
    headers.Authorization = `Bearer ${await sign({ sub: "user-1" }, SECRET)}`;
  }
  return app.request(
    "/api/dojo-masters",
    { method: "POST", headers, body: JSON.stringify(body) },
    { SUPABASE_JWT_SECRET: SECRET },
  );
}

describe("POST /api/dojo-masters", () => {
  it("新規道場を追加できる(未承認で作成)", async () => {
    const app = buildApp(createWriteMock({ existing: null }));

    const res = await postDojo(app, { dojoName: "蕨合気道会 子ども部" });

    expect(res.status).toBe(200);
    const json = (await res.json()) as {
      data: { is_approved: boolean; existed: boolean };
    };
    expect(json.data.is_approved).toBe(false);
    expect(json.data.existed).toBe(false);
  });

  it("既存と一致したら既存を返す(existed=true)", async () => {
    const app = buildApp(
      createWriteMock({
        existing: {
          id: "00000000-0000-0000-0000-000000000001",
          dojo_name: "合気会本部道場",
          dojo_name_kana: "あいきかいほんぶどうじょう",
          is_approved: true,
        },
      }),
    );

    const res = await postDojo(app, { dojoName: "合気会本部道場" });

    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({
      data: { existed: true, dojo_name: "合気会本部道場" },
    });
  });

  it("空の道場名は 400", async () => {
    const app = buildApp(createWriteMock({ existing: null }));

    const res = await postDojo(app, { dojoName: "   " });

    expect(res.status).toBe(400);
  });

  it("認証が無ければ 401", async () => {
    const app = buildApp(createWriteMock({ existing: null }));

    const res = await postDojo(app, { dojoName: "新道場" }, false);

    expect(res.status).toBe(401);
  });
});

describe("GET /api/dojo-masters", () => {
  it("検索結果を返す", async () => {
    // Arrange
    const app = buildApp(createSupabaseMock({ data: SEED, error: null }));

    // Act
    const res = await getDojos(app, "?q=合気");

    // Assert
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ success: true, data: SEED });
  });

  it("q 無しでも 200 を返す", async () => {
    // Arrange
    const app = buildApp(createSupabaseMock({ data: SEED, error: null }));

    // Act
    const res = await getDojos(app, "");

    // Assert
    expect(res.status).toBe(200);
  });

  it("認証が無ければ 401 を返す", async () => {
    // Arrange
    const app = buildApp(createSupabaseMock({ data: [], error: null }));

    // Act
    const res = await app.request(
      "/api/dojo-masters",
      {},
      { SUPABASE_JWT_SECRET: SECRET },
    );

    // Assert
    expect(res.status).toBe(401);
  });
});
