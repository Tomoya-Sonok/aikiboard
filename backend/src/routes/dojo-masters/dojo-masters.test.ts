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
