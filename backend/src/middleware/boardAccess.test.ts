import type { SupabaseClient } from "@supabase/supabase-js";
import { Hono } from "hono";
import { sign } from "hono/jwt";
import { describe, expect, it } from "vitest";
import type { AppBindings, AppVariables } from "../app.js";
import { authMiddleware } from "./auth.js";
import { boardAdminMiddleware, boardMemberMiddleware } from "./boardAccess.js";

const SECRET = "test-secret-token-with-at-least-32-characters";
const BOARD_ID = "00000000-0000-0000-0000-0000000000aa";

type TestEnv = { Bindings: AppBindings; Variables: AppVariables };

// board_members の role 解決と、:id ルート用の events.board_id 解決だけを満たすスタブ。
function createMock(opts: {
  role?: "owner" | "admin" | "member" | null;
  eventBoardId?: string | null;
}) {
  const role = opts.role === undefined ? "member" : opts.role;
  const aikiboard = {
    from: (table: string) => {
      if (table === "board_members") {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                maybeSingle: async () => ({
                  data: role ? { role } : null,
                  error: null,
                }),
              }),
            }),
          }),
        };
      }
      if (table === "events") {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({
                data:
                  opts.eventBoardId === undefined
                    ? { board_id: BOARD_ID }
                    : opts.eventBoardId
                      ? { board_id: opts.eventBoardId }
                      : null,
                error: null,
              }),
            }),
          }),
        };
      }
      return {};
    },
  };
  return { schema: () => aikiboard } as unknown as SupabaseClient;
}

function buildApp(supabase: SupabaseClient) {
  const app = new Hono<TestEnv>();
  app.use("*", async (c, next) => {
    c.set("supabase", supabase);
    await next();
  });
  // boardId は query から解決させる。
  app.get("/member", authMiddleware, boardMemberMiddleware, (c) =>
    c.json({ success: true, role: c.get("boardRole") }),
  );
  app.get("/admin", authMiddleware, boardAdminMiddleware, (c) =>
    c.json({ success: true, role: c.get("boardRole") }),
  );
  return app;
}

async function call(app: Hono<TestEnv>, path: string, withAuth = true) {
  const headers: Record<string, string> = {};
  if (withAuth) {
    const token = await sign({ sub: "user-1" }, SECRET);
    headers.Authorization = `Bearer ${token}`;
  }
  return app.request(
    path,
    { method: "GET", headers },
    { SUPABASE_JWT_SECRET: SECRET },
  );
}

describe("boardMemberMiddleware", () => {
  it("メンバーなら通過し role を ctx に載せる", async () => {
    // Arrange
    const app = buildApp(createMock({ role: "member" }));

    // Act
    const res = await call(app, `/member?boardId=${BOARD_ID}`);

    // Assert
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ role: "member" });
  });

  it("非メンバーは 404", async () => {
    // Arrange
    const app = buildApp(createMock({ role: null }));

    // Act
    const res = await call(app, `/member?boardId=${BOARD_ID}`);

    // Assert
    expect(res.status).toBe(404);
  });

  it("認証が無ければ 401", async () => {
    // Arrange
    const app = buildApp(createMock({ role: "member" }));

    // Act
    const res = await call(app, `/member?boardId=${BOARD_ID}`, false);

    // Assert
    expect(res.status).toBe(401);
  });

  it("boardId を解決できなければ 404", async () => {
    // Arrange
    const app = buildApp(createMock({ role: "member" }));

    // Act(boardId 無し)
    const res = await call(app, "/member");

    // Assert
    expect(res.status).toBe(404);
  });
});

describe("boardAdminMiddleware", () => {
  it("owner / admin は通過する", async () => {
    // Arrange
    const app = buildApp(createMock({ role: "admin" }));

    // Act
    const res = await call(app, `/admin?boardId=${BOARD_ID}`);

    // Assert
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ role: "admin" });
  });

  it("member は 403", async () => {
    // Arrange
    const app = buildApp(createMock({ role: "member" }));

    // Act
    const res = await call(app, `/admin?boardId=${BOARD_ID}`);

    // Assert
    expect(res.status).toBe(403);
  });
});
