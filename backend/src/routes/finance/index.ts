// 会計の見える化 API(要件 4.8、有料機能 accounting)。owner/admin のみ。
// 決済はオフライン前提で、月謝ステータスの手動記録 + 支出記録 + 収支可視化を提供する。
//
//   月謝設定:  GET /api/finance/fees        / PUT /api/finance/fees
//   支払状況:  GET /api/finance/payments    / PUT /api/finance/payments
//   支出:      GET/POST /api/finance/expenses, PATCH/DELETE /api/finance/expenses/:id
//   収支:      GET /api/finance/summary
//
// 認可は boardAccess(admin)+ requireFeature("accounting")。:id を持つ支出の編集/削除のみ
// expense_entries から board_id を解決する(financeExpenseAdminMiddleware)。

import { type Context, Hono } from "hono";
import { z } from "zod";
import type { AppBindings, AppVariables } from "../../app.js";
import { logger } from "../../lib/logger.js";
import { authMiddleware } from "../../middleware/auth.js";
import {
  financeAdminMiddleware,
  financeExpenseAdminMiddleware,
} from "../../middleware/boardAccess.js";
import { requireFeature } from "../../middleware/featureGuard.js";

type FinanceEnv = { Bindings: AppBindings; Variables: AppVariables };

const financeRoute = new Hono<FinanceEnv>();

const uuidLike = z
  .string()
  .regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
const periodSchema = z.string().regex(/^[0-9]{6}$/);

const parseJson = async (c: Context<FinanceEnv>): Promise<unknown> => {
  try {
    return await c.req.json();
  } catch {
    return undefined;
  }
};

type UserInfo = { username: string; profileImageUrl: string | null };
const resolveUsers = async (
  supabase: NonNullable<AppVariables["supabase"]>,
  ids: string[],
): Promise<Map<string, UserInfo>> => {
  const byId = new Map<string, UserInfo>();
  const unique = [...new Set(ids)];
  if (unique.length === 0) return byId;
  const { data } = await supabase
    .from("User")
    .select("id, username, profile_image_url")
    .in("id", unique);
  for (const u of data ?? []) {
    byId.set(u.id, {
      username: u.username ?? "",
      profileImageUrl: u.profile_image_url ?? null,
    });
  }
  return byId;
};

// ボードの現メンバー user_id 一覧。
const fetchMemberIds = async (
  supabase: NonNullable<AppVariables["supabase"]>,
  boardId: string,
): Promise<string[] | null> => {
  const { data, error } = await supabase
    .schema("aikiboard")
    .from("board_members")
    .select("user_id")
    .eq("board_id", boardId);
  if (error) return null;
  return (data ?? []).map((m) => m.user_id as string);
};

// 各 user の「現在の月謝」= effective_from 最新の monthly_fee。
const currentFeeByUser = async (
  supabase: NonNullable<AppVariables["supabase"]>,
  boardId: string,
): Promise<Map<string, number>> => {
  const result = new Map<string, number>();
  const { data } = await supabase
    .schema("aikiboard")
    .from("member_fees")
    .select("user_id, monthly_fee, effective_from")
    .eq("board_id", boardId)
    .order("effective_from", { ascending: true });
  // 昇順で走査し、後勝ちで最新を残す。
  for (const row of data ?? []) {
    result.set(row.user_id as string, row.monthly_fee as number);
  }
  return result;
};

// ────────────────────────────────────────────────────────────────
// GET /api/finance/fees?boardId= — メンバー一覧 + 現在の月謝
// ────────────────────────────────────────────────────────────────
financeRoute.get(
  "/fees",
  authMiddleware,
  financeAdminMiddleware,
  requireFeature("accounting"),
  async (c) => {
    const supabase = c.get("supabase");
    if (!supabase) {
      return c.json({ success: false, error: "サーバー設定が不正です" }, 500);
    }
    const boardId = c.get("boardId") as string;

    const memberIds = await fetchMemberIds(supabase, boardId);
    if (!memberIds) {
      return c.json({ success: false, error: "取得に失敗しました" }, 500);
    }
    const [fees, users] = await Promise.all([
      currentFeeByUser(supabase, boardId),
      resolveUsers(supabase, memberIds),
    ]);
    const items = memberIds
      .map((userId) => ({
        userId,
        username: users.get(userId)?.username ?? "",
        profileImageUrl: users.get(userId)?.profileImageUrl ?? null,
        monthlyFee: fees.get(userId) ?? null,
      }))
      .sort((a, b) => a.username.localeCompare(b.username, "ja"));
    return c.json({ success: true, data: items });
  },
);

// ────────────────────────────────────────────────────────────────
// PUT /api/finance/fees — メンバーの月謝を設定(effective_from = 今日)
// ────────────────────────────────────────────────────────────────
const setFeeSchema = z.object({
  boardId: uuidLike,
  userId: uuidLike,
  monthlyFee: z.number().int().min(0).max(10000000),
});
financeRoute.put(
  "/fees",
  authMiddleware,
  financeAdminMiddleware,
  requireFeature("accounting"),
  async (c) => {
    const supabase = c.get("supabase");
    if (!supabase) {
      return c.json({ success: false, error: "サーバー設定が不正です" }, 500);
    }
    const boardId = c.get("boardId") as string;
    const parsed = setFeeSchema.safeParse(await parseJson(c));
    if (!parsed.success) {
      return c.json({ success: false, error: "入力内容に誤りがあります" }, 400);
    }
    const today = new Date().toISOString().slice(0, 10);
    const { error } = await supabase
      .schema("aikiboard")
      .from("member_fees")
      .upsert(
        {
          board_id: boardId,
          user_id: parsed.data.userId,
          monthly_fee: parsed.data.monthlyFee,
          effective_from: today,
        },
        { onConflict: "board_id,user_id,effective_from" },
      );
    if (error) {
      logger.error("月謝設定の保存に失敗", { feature: "finance", boardId });
      return c.json({ success: false, error: "保存に失敗しました" }, 500);
    }
    return c.json({ success: true, message: "月謝を設定しました" });
  },
);

// ────────────────────────────────────────────────────────────────
// GET /api/finance/payments?boardId=&period=YYYYMM — 期間の支払状況一覧
// ────────────────────────────────────────────────────────────────
financeRoute.get(
  "/payments",
  authMiddleware,
  financeAdminMiddleware,
  requireFeature("accounting"),
  async (c) => {
    const supabase = c.get("supabase");
    if (!supabase) {
      return c.json({ success: false, error: "サーバー設定が不正です" }, 500);
    }
    const boardId = c.get("boardId") as string;
    const period = c.req.query("period") ?? "";
    if (!/^[0-9]{6}$/.test(period)) {
      return c.json({ success: false, error: "期間の指定が不正です" }, 400);
    }
    const aikiboard = supabase.schema("aikiboard");

    const memberIds = await fetchMemberIds(supabase, boardId);
    if (!memberIds) {
      return c.json({ success: false, error: "取得に失敗しました" }, 500);
    }
    const [fees, users, paymentsRes] = await Promise.all([
      currentFeeByUser(supabase, boardId),
      resolveUsers(supabase, memberIds),
      aikiboard
        .from("fee_payments")
        .select("user_id, status, amount")
        .eq("board_id", boardId)
        .eq("period_yyyymm", period),
    ]);
    const paymentByUser = new Map<
      string,
      { status: string; amount: number | null }
    >();
    for (const p of paymentsRes.data ?? []) {
      paymentByUser.set(p.user_id as string, {
        status: p.status as string,
        amount: (p.amount as number | null) ?? null,
      });
    }
    const items = memberIds
      .map((userId) => {
        const pay = paymentByUser.get(userId);
        return {
          userId,
          username: users.get(userId)?.username ?? "",
          profileImageUrl: users.get(userId)?.profileImageUrl ?? null,
          monthlyFee: fees.get(userId) ?? null,
          status: pay?.status ?? "unpaid",
        };
      })
      .sort((a, b) => a.username.localeCompare(b.username, "ja"));
    return c.json({ success: true, data: items });
  },
);

// ────────────────────────────────────────────────────────────────
// PUT /api/finance/payments — 支払ステータスを設定
// ────────────────────────────────────────────────────────────────
const setPaymentSchema = z.object({
  boardId: uuidLike,
  userId: uuidLike,
  period: periodSchema,
  status: z.enum(["paid", "unpaid", "waived"]),
});
financeRoute.put(
  "/payments",
  authMiddleware,
  financeAdminMiddleware,
  requireFeature("accounting"),
  async (c) => {
    const supabase = c.get("supabase");
    if (!supabase) {
      return c.json({ success: false, error: "サーバー設定が不正です" }, 500);
    }
    const boardId = c.get("boardId") as string;
    const parsed = setPaymentSchema.safeParse(await parseJson(c));
    if (!parsed.success) {
      return c.json({ success: false, error: "入力内容に誤りがあります" }, 400);
    }
    const { userId, period, status } = parsed.data;

    // paid のときは支払時点の月謝額を記録する(収支集計の基準)。
    let amount: number | null = null;
    if (status === "paid") {
      const fees = await currentFeeByUser(supabase, boardId);
      amount = fees.get(userId) ?? null;
    }
    const { error } = await supabase
      .schema("aikiboard")
      .from("fee_payments")
      .upsert(
        {
          board_id: boardId,
          user_id: userId,
          period_yyyymm: period,
          status,
          paid_at: status === "paid" ? new Date().toISOString() : null,
          amount,
        },
        { onConflict: "board_id,user_id,period_yyyymm" },
      );
    if (error) {
      logger.error("支払ステータスの保存に失敗", {
        feature: "finance",
        boardId,
      });
      return c.json({ success: false, error: "保存に失敗しました" }, 500);
    }
    return c.json({ success: true, message: "支払状況を更新しました" });
  },
);

// ────────────────────────────────────────────────────────────────
// GET /api/finance/expenses?boardId=&year= — 支出一覧(year 指定で絞り込み)
// ────────────────────────────────────────────────────────────────
financeRoute.get(
  "/expenses",
  authMiddleware,
  financeAdminMiddleware,
  requireFeature("accounting"),
  async (c) => {
    const supabase = c.get("supabase");
    if (!supabase) {
      return c.json({ success: false, error: "サーバー設定が不正です" }, 500);
    }
    const boardId = c.get("boardId") as string;
    const year = Number(c.req.query("year"));
    const aikiboard = supabase.schema("aikiboard");

    let query = aikiboard
      .from("expense_entries")
      .select("id, date, category, amount, note")
      .eq("board_id", boardId)
      .order("date", { ascending: false });
    if (Number.isInteger(year) && year > 1900 && year < 3000) {
      query = query.gte("date", `${year}-01-01`).lte("date", `${year}-12-31`);
    }
    const { data, error } = await query;
    if (error) {
      logger.error("支出の取得に失敗", { feature: "finance", boardId });
      return c.json({ success: false, error: "取得に失敗しました" }, 500);
    }
    const items = (data ?? []).map((r) => ({
      id: r.id as string,
      date: r.date as string,
      category: r.category as string,
      amount: r.amount as number,
      note: (r.note as string | null) ?? null,
    }));
    return c.json({ success: true, data: items });
  },
);

// ────────────────────────────────────────────────────────────────
// POST /api/finance/expenses — 支出を追加
// ────────────────────────────────────────────────────────────────
const expenseSchema = z.object({
  boardId: uuidLike,
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  category: z.string().trim().min(1).max(50),
  amount: z.number().int().min(0).max(1000000000),
  note: z.string().max(500).optional(),
});
financeRoute.post(
  "/expenses",
  authMiddleware,
  financeAdminMiddleware,
  requireFeature("accounting"),
  async (c) => {
    const supabase = c.get("supabase");
    if (!supabase) {
      return c.json({ success: false, error: "サーバー設定が不正です" }, 500);
    }
    const boardId = c.get("boardId") as string;
    const userId = c.get("userId") as string;
    const parsed = expenseSchema.safeParse(await parseJson(c));
    if (!parsed.success) {
      return c.json({ success: false, error: "入力内容に誤りがあります" }, 400);
    }
    const { data, error } = await supabase
      .schema("aikiboard")
      .from("expense_entries")
      .insert({
        board_id: boardId,
        date: parsed.data.date,
        category: parsed.data.category,
        amount: parsed.data.amount,
        note: parsed.data.note ?? null,
        created_by_user_id: userId,
      })
      .select("id")
      .single();
    if (error || !data) {
      logger.error("支出の追加に失敗", { feature: "finance", boardId });
      return c.json({ success: false, error: "保存に失敗しました" }, 500);
    }
    return c.json({
      success: true,
      data: { id: data.id },
      message: "支出を追加しました",
    });
  },
);

// ────────────────────────────────────────────────────────────────
// PATCH /api/finance/expenses/:id — 支出を編集
// ────────────────────────────────────────────────────────────────
const expenseUpdateSchema = z.object({
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  category: z.string().trim().min(1).max(50).optional(),
  amount: z.number().int().min(0).max(1000000000).optional(),
  note: z.string().max(500).nullable().optional(),
});
financeRoute.patch(
  "/expenses/:id",
  authMiddleware,
  financeExpenseAdminMiddleware,
  requireFeature("accounting"),
  async (c) => {
    const supabase = c.get("supabase");
    if (!supabase) {
      return c.json({ success: false, error: "サーバー設定が不正です" }, 500);
    }
    const id = c.req.param("id");
    const parsed = expenseUpdateSchema.safeParse(await parseJson(c));
    if (!parsed.success) {
      return c.json({ success: false, error: "入力内容に誤りがあります" }, 400);
    }
    const p = parsed.data;
    const update: Record<string, unknown> = {};
    if (p.date !== undefined) update.date = p.date;
    if (p.category !== undefined) update.category = p.category;
    if (p.amount !== undefined) update.amount = p.amount;
    if (p.note !== undefined) update.note = p.note;
    if (Object.keys(update).length === 0) {
      return c.json({ success: false, error: "変更内容がありません" }, 400);
    }
    const { error } = await supabase
      .schema("aikiboard")
      .from("expense_entries")
      .update(update)
      .eq("id", id);
    if (error) {
      logger.error("支出の更新に失敗", { feature: "finance", expenseId: id });
      return c.json({ success: false, error: "更新に失敗しました" }, 500);
    }
    return c.json({ success: true, message: "支出を更新しました" });
  },
);

// ────────────────────────────────────────────────────────────────
// DELETE /api/finance/expenses/:id — 支出を削除
// ────────────────────────────────────────────────────────────────
financeRoute.delete(
  "/expenses/:id",
  authMiddleware,
  financeExpenseAdminMiddleware,
  requireFeature("accounting"),
  async (c) => {
    const supabase = c.get("supabase");
    if (!supabase) {
      return c.json({ success: false, error: "サーバー設定が不正です" }, 500);
    }
    const id = c.req.param("id");
    const { error } = await supabase
      .schema("aikiboard")
      .from("expense_entries")
      .delete()
      .eq("id", id);
    if (error) {
      logger.error("支出の削除に失敗", { feature: "finance", expenseId: id });
      return c.json({ success: false, error: "削除に失敗しました" }, 500);
    }
    return c.json({ success: true, message: "支出を削除しました" });
  },
);

// ────────────────────────────────────────────────────────────────
// GET /api/finance/summary?boardId=&year= — 年次の月別収支
// ────────────────────────────────────────────────────────────────
financeRoute.get(
  "/summary",
  authMiddleware,
  financeAdminMiddleware,
  requireFeature("accounting"),
  async (c) => {
    const supabase = c.get("supabase");
    if (!supabase) {
      return c.json({ success: false, error: "サーバー設定が不正です" }, 500);
    }
    const boardId = c.get("boardId") as string;
    const year = Number(c.req.query("year"));
    if (!Number.isInteger(year) || year < 1900 || year > 3000) {
      return c.json({ success: false, error: "年の指定が不正です" }, 400);
    }
    const aikiboard = supabase.schema("aikiboard");

    const income = new Array(12).fill(0);
    const expense = new Array(12).fill(0);

    // 収入: paid の月謝(period_yyyymm の月別、amount を集計)。
    const { data: payments, error: payErr } = await aikiboard
      .from("fee_payments")
      .select("period_yyyymm, amount, status")
      .eq("board_id", boardId)
      .eq("status", "paid")
      .gte("period_yyyymm", `${year}01`)
      .lte("period_yyyymm", `${year}12`);
    if (payErr) {
      return c.json({ success: false, error: "取得に失敗しました" }, 500);
    }
    for (const p of payments ?? []) {
      const m = Number((p.period_yyyymm as string).slice(4, 6)) - 1;
      if (m >= 0 && m < 12) income[m] += (p.amount as number | null) ?? 0;
    }

    // 支出: date の月別。
    const { data: expenses, error: expErr } = await aikiboard
      .from("expense_entries")
      .select("date, amount")
      .eq("board_id", boardId)
      .gte("date", `${year}-01-01`)
      .lte("date", `${year}-12-31`);
    if (expErr) {
      return c.json({ success: false, error: "取得に失敗しました" }, 500);
    }
    for (const e of expenses ?? []) {
      const m = Number((e.date as string).slice(5, 7)) - 1;
      if (m >= 0 && m < 12) expense[m] += (e.amount as number | null) ?? 0;
    }

    const months = Array.from({ length: 12 }, (_, i) => ({
      month: i + 1,
      income: income[i],
      expense: expense[i],
    }));
    return c.json({
      success: true,
      data: {
        year,
        months,
        totalIncome: income.reduce((a, b) => a + b, 0),
        totalExpense: expense.reduce((a, b) => a + b, 0),
      },
    });
  },
);

export default financeRoute;
