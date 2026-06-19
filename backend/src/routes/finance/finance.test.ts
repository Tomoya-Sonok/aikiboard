import type { SupabaseClient } from "@supabase/supabase-js";
import { Hono } from "hono";
import { sign } from "hono/jwt";
import { describe, expect, it } from "vitest";
import financeRoute from "./index.js";

const SECRET = "test-secret-token-with-at-least-32-characters";
const BOARD_ID = "00000000-0000-0000-0000-0000000000aa";
const U1 = "00000000-0000-0000-0000-0000000000b1";

type Role = "owner" | "admin" | "member" | null;

function createMock(opts: {
  role?: Role;
  featureCodes?: string[];
  memberIds?: string[];
  feeRows?: Record<string, unknown>[];
  paymentRows?: Record<string, unknown>[];
  expenseRows?: Record<string, unknown>[];
  users?: { id: string; username: string; profile_image_url: string | null }[];
  resolvedBoardId?: string | null;
}) {
  const role: Role = opts.role === undefined ? "admin" : opts.role;
  const features = opts.featureCodes ?? ["accounting"];
  const resolvedBoardId =
    opts.resolvedBoardId === undefined ? BOARD_ID : opts.resolvedBoardId;

  const aikiboard = {
    from: (table: string) => {
      if (table === "board_members") {
        return makeChain((s) =>
          s.columns.startsWith("role")
            ? { data: role ? { role } : null, error: null }
            : {
                data: (opts.memberIds ?? [U1]).map((id) => ({ user_id: id })),
                error: null,
              },
        );
      }
      if (table === "board_subscriptions") {
        return makeChain(() => ({
          data: { plan_id: "p1", status: "active" },
          error: null,
        }));
      }
      if (table === "plans") {
        return makeChain(() => ({ data: { id: "free" }, error: null }));
      }
      if (table === "plan_features") {
        return makeChain(() => ({
          data: features.map((c) => ({ feature_code: c })),
          error: null,
        }));
      }
      if (table === "member_fees") {
        return makeChain((s) =>
          s.op === "upsert"
            ? { error: null }
            : { data: opts.feeRows ?? [], error: null },
        );
      }
      if (table === "fee_payments") {
        return makeChain((s) =>
          s.op === "upsert"
            ? { error: null }
            : { data: opts.paymentRows ?? [], error: null },
        );
      }
      if (table === "expense_entries") {
        return makeChain((s) => {
          if (s.op === "insert") return { data: { id: "exp1" }, error: null };
          if (s.op === "update" || s.op === "delete") return { error: null };
          if (s.columns.startsWith("board_id") && s.single) {
            return {
              data: resolvedBoardId ? { board_id: resolvedBoardId } : null,
              error: null,
            };
          }
          return { data: opts.expenseRows ?? [], error: null };
        });
      }
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
  op: "insert" | "update" | "delete" | "upsert" | null;
};
function makeChain(resolver: (s: ChainState) => unknown) {
  const state: ChainState = { columns: "", single: false, op: null };
  const resolve = () => Promise.resolve(resolver(state));
  const chain: Record<string, unknown> = {
    select: (cols?: string) => {
      if (typeof cols === "string") state.columns = cols;
      return chain;
    },
    eq: () => chain,
    in: () => chain,
    order: () => chain,
    gte: () => chain,
    lte: () => chain,
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
  app.route("/api/finance", financeRoute);
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
    headers.Authorization = `Bearer ${await sign({ sub: "user-1" }, SECRET)}`;
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

describe("GET /api/finance/fees", () => {
  it("admin + 機能ありでメンバー + 月謝を返す", async () => {
    const { supabase } = createMock({
      role: "admin",
      memberIds: [U1],
      feeRows: [
        { user_id: U1, monthly_fee: 5000, effective_from: "2026-04-01" },
      ],
      users: [{ id: U1, username: "門人", profile_image_url: null }],
    });
    const app = buildApp(supabase);

    const res = await request(app, `/api/finance/fees?boardId=${BOARD_ID}`, {
      method: "GET",
    });

    expect(res.status).toBe(200);
    const json = (await res.json()) as {
      data: { username: string; monthlyFee: number | null }[];
    };
    expect(json.data[0].monthlyFee).toBe(5000);
  });

  it("accounting 機能なしは 403", async () => {
    const { supabase } = createMock({
      role: "admin",
      featureCodes: ["calendar"],
    });
    const app = buildApp(supabase);

    const res = await request(app, `/api/finance/fees?boardId=${BOARD_ID}`, {
      method: "GET",
    });

    expect(res.status).toBe(403);
  });

  it("member は 403", async () => {
    const { supabase } = createMock({ role: "member" });
    const app = buildApp(supabase);

    const res = await request(app, `/api/finance/fees?boardId=${BOARD_ID}`, {
      method: "GET",
    });

    expect(res.status).toBe(403);
  });
});

describe("PUT /api/finance/payments", () => {
  it("支払ステータスを更新できる", async () => {
    const { supabase } = createMock({ role: "admin" });
    const app = buildApp(supabase);

    const res = await request(app, "/api/finance/payments", {
      method: "PUT",
      body: { boardId: BOARD_ID, userId: U1, period: "202607", status: "paid" },
    });

    expect(res.status).toBe(200);
  });

  it("不正な period は 400", async () => {
    const { supabase } = createMock({ role: "admin" });
    const app = buildApp(supabase);

    const res = await request(app, "/api/finance/payments", {
      method: "PUT",
      body: { boardId: BOARD_ID, userId: U1, period: "2026", status: "paid" },
    });

    expect(res.status).toBe(400);
  });
});

describe("POST /api/finance/expenses", () => {
  it("支出を追加できる", async () => {
    const { supabase } = createMock({ role: "admin" });
    const app = buildApp(supabase);

    const res = await request(app, "/api/finance/expenses", {
      method: "POST",
      body: {
        boardId: BOARD_ID,
        date: "2026-07-01",
        category: "venue",
        amount: 12000,
      },
    });

    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ data: { id: "exp1" } });
  });
});

describe("GET /api/finance/summary", () => {
  it("月別の収支を返す", async () => {
    const { supabase } = createMock({
      role: "admin",
      paymentRows: [
        { period_yyyymm: "202607", amount: 5000, status: "paid" },
        { period_yyyymm: "202607", amount: 5000, status: "paid" },
      ],
      expenseRows: [{ date: "2026-07-10", amount: 3000 }],
    });
    const app = buildApp(supabase);

    const res = await request(
      app,
      `/api/finance/summary?boardId=${BOARD_ID}&year=2026`,
      { method: "GET" },
    );

    expect(res.status).toBe(200);
    const json = (await res.json()) as {
      data: {
        totalIncome: number;
        totalExpense: number;
        months: { month: number; income: number; expense: number }[];
      };
    };
    expect(json.data.totalIncome).toBe(10000);
    expect(json.data.totalExpense).toBe(3000);
    expect(json.data.months[6]).toMatchObject({ income: 10000, expense: 3000 });
  });
});
