import { Hono } from "hono";
import { sign } from "hono/jwt";
import { describe, expect, it } from "vitest";
import { authMiddleware } from "./auth.js";

const SECRET = "test-secret-token-with-at-least-32-characters";

// authMiddleware を載せた検証用アプリ。第3引数(env)で SUPABASE_JWT_SECRET 等を渡せる。
// ローカル/本番のトークンは ES256(JWKS)だが、ここでは HS256 フォールバック経路を
// secret で直接検証する(ES256/JWKS の経路は lib/jwt.test.ts + ローカル疎通でカバー)。
function buildApp() {
  const app = new Hono<{
    Bindings: { SUPABASE_URL?: string; SUPABASE_JWT_SECRET?: string };
    Variables: { userId?: string };
  }>();
  app.get("/probe", authMiddleware, (c) => c.json({ userId: c.get("userId") }));
  return app;
}

describe("authMiddleware", () => {
  it("有効な HS256 token で userId をセットして通す", async () => {
    // Arrange
    const app = buildApp();
    const token = await sign({ sub: "user-1" }, SECRET);

    // Act
    const res = await app.request(
      "/probe",
      { headers: { Authorization: `Bearer ${token}` } },
      { SUPABASE_JWT_SECRET: SECRET },
    );

    // Assert
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ userId: "user-1" });
  });

  it("Authorization ヘッダが無いと 401 を返す", async () => {
    // Arrange
    const app = buildApp();

    // Act
    const res = await app.request(
      "/probe",
      {},
      { SUPABASE_JWT_SECRET: SECRET },
    );

    // Assert
    expect(res.status).toBe(401);
  });

  it("不正な token は 401 を返す", async () => {
    // Arrange
    const app = buildApp();

    // Act
    const res = await app.request(
      "/probe",
      { headers: { Authorization: "Bearer not-a-valid-jwt" } },
      { SUPABASE_JWT_SECRET: SECRET },
    );

    // Assert
    expect(res.status).toBe(401);
  });

  it("別 secret で署名された HS256 token は 401 を返す", async () => {
    // Arrange
    const app = buildApp();
    const token = await sign(
      { sub: "user-1" },
      "another-secret-value-32-chars-long",
    );

    // Act
    const res = await app.request(
      "/probe",
      { headers: { Authorization: `Bearer ${token}` } },
      { SUPABASE_JWT_SECRET: SECRET },
    );

    // Assert
    expect(res.status).toBe(401);
  });

  it("HS256 token で secret 未設定なら 401 を返す", async () => {
    // Arrange
    const app = buildApp();
    const token = await sign({ sub: "user-1" }, SECRET);

    // Act(env に secret を渡さない)
    const res = await app.request("/probe", {
      headers: { Authorization: `Bearer ${token}` },
    });

    // Assert
    expect(res.status).toBe(401);
  });
});
