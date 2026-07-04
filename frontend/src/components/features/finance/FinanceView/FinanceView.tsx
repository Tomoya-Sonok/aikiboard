"use client";

import { CaretLeft, CaretRight, Plus, Trash } from "@phosphor-icons/react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { Avatar } from "@/components/shared/Avatar/Avatar";
import { trpcClient } from "@/lib/trpc/client";
import type { PaymentStatus } from "@/lib/types/finance";
import styles from "./FinanceView.module.css";

type Props = {
  boardId: string;
};

type Tab = "payments" | "expenses" | "summary";

const yen = (n: number) => `¥${new Intl.NumberFormat("ja-JP").format(n)}`;

// 今月の YYYYMM。
const thisPeriod = (): string => {
  const now = new Date();
  return `${now.getUTCFullYear()}${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
};
const thisYear = (): number => new Date().getUTCFullYear();

const shiftPeriod = (period: string, delta: number): string => {
  const y = Number(period.slice(0, 4));
  const m = Number(period.slice(4, 6));
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
};

export function FinanceView({ boardId }: Props) {
  const t = useTranslations("boards.finance");
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<Tab>("payments");
  const [period, setPeriod] = useState(thisPeriod());
  const [year, setYear] = useState(thisYear());

  const periodLabel = `${period.slice(0, 4)}/${period.slice(4, 6)}`;

  return (
    <div className={styles.wrapper}>
      <h1 className={styles.heading}>{t("title")}</h1>

      <div className={styles.tabs}>
        <button
          type="button"
          className={`${styles.tab} ${tab === "payments" ? styles.tabActive : ""}`}
          onClick={() => setTab("payments")}
        >
          {t("tabPayments")}
        </button>
        <button
          type="button"
          className={`${styles.tab} ${tab === "expenses" ? styles.tabActive : ""}`}
          onClick={() => setTab("expenses")}
        >
          {t("tabExpenses")}
        </button>
        <button
          type="button"
          className={`${styles.tab} ${tab === "summary" ? styles.tabActive : ""}`}
          onClick={() => setTab("summary")}
        >
          {t("tabSummary")}
        </button>
      </div>

      {tab === "payments" ? (
        <PaymentsTab
          boardId={boardId}
          period={period}
          periodLabel={periodLabel}
          onPrev={() => setPeriod((p) => shiftPeriod(p, -1))}
          onNext={() => setPeriod((p) => shiftPeriod(p, 1))}
          queryClient={queryClient}
        />
      ) : tab === "expenses" ? (
        <ExpensesTab
          boardId={boardId}
          year={year}
          onPrev={() => setYear((y) => y - 1)}
          onNext={() => setYear((y) => y + 1)}
          queryClient={queryClient}
        />
      ) : (
        <SummaryTab
          boardId={boardId}
          year={year}
          onPrev={() => setYear((y) => y - 1)}
          onNext={() => setYear((y) => y + 1)}
        />
      )}
    </div>
  );
}

type QueryClient = ReturnType<typeof useQueryClient>;

// ── 月謝・支払タブ ───────────────────────────────────────────────
function PaymentsTab({
  boardId,
  period,
  periodLabel,
  onPrev,
  onNext,
  queryClient,
}: {
  boardId: string;
  period: string;
  periodLabel: string;
  onPrev: () => void;
  onNext: () => void;
  queryClient: QueryClient;
}) {
  const t = useTranslations("boards.finance");
  const { data, isLoading } = useQuery({
    queryKey: ["finance", boardId, "payments", period],
    queryFn: () => trpcClient.finance.payments.query({ boardId, period }),
  });
  const members = data?.data ?? [];

  const refresh = () =>
    queryClient.invalidateQueries({ queryKey: ["finance", boardId] });

  const handleFee = async (userId: string, raw: string) => {
    const monthlyFee = Number(raw);
    if (!Number.isFinite(monthlyFee) || monthlyFee < 0) return;
    await trpcClient.finance.setFee.mutate({ boardId, userId, monthlyFee });
    refresh();
  };

  const handleStatus = async (userId: string, status: PaymentStatus) => {
    await trpcClient.finance.setPayment.mutate({
      boardId,
      userId,
      period,
      status,
    });
    refresh();
  };

  return (
    <div className={styles.panel}>
      <div className={styles.periodNav}>
        <button type="button" className={styles.navBtn} onClick={onPrev}>
          <CaretLeft size={14} />
        </button>
        <span className={styles.periodLabel}>{periodLabel}</span>
        <button type="button" className={styles.navBtn} onClick={onNext}>
          <CaretRight size={14} />
        </button>
      </div>

      {isLoading ? (
        <p className={styles.empty}>{t("loading")}</p>
      ) : members.length === 0 ? (
        <p className={styles.empty}>{t("noMembers")}</p>
      ) : (
        <ul className={styles.roster}>
          {members.map((m) => (
            <li key={m.userId} className={styles.row}>
              <span className={styles.member}>
                <Avatar
                  name={m.username}
                  imageUrl={m.profileImageUrl}
                  size={28}
                />
                <span className={styles.name}>{m.username || "—"}</span>
              </span>
              <span className={styles.feeCell}>
                <span className={styles.yen}>¥</span>
                <input
                  type="number"
                  min={0}
                  className={styles.feeInput}
                  defaultValue={m.monthlyFee ?? ""}
                  placeholder="0"
                  onBlur={(e) => {
                    if (e.target.value !== String(m.monthlyFee ?? "")) {
                      handleFee(m.userId, e.target.value);
                    }
                  }}
                />
              </span>
              <select
                className={`${styles.status} ${styles[`status_${m.status}`]}`}
                value={m.status}
                onChange={(e) =>
                  handleStatus(m.userId, e.target.value as PaymentStatus)
                }
              >
                <option value="unpaid">{t("unpaid")}</option>
                <option value="paid">{t("paid")}</option>
                <option value="waived">{t("waived")}</option>
              </select>
            </li>
          ))}
        </ul>
      )}
      <p className={styles.note}>{t("feeNote")}</p>
    </div>
  );
}

// ── 支出タブ ─────────────────────────────────────────────────────
function ExpensesTab({
  boardId,
  year,
  onPrev,
  onNext,
  queryClient,
}: {
  boardId: string;
  year: number;
  onPrev: () => void;
  onNext: () => void;
  queryClient: QueryClient;
}) {
  const t = useTranslations("boards.finance");
  const { data, isLoading } = useQuery({
    queryKey: ["finance", boardId, "expenses", year],
    queryFn: () => trpcClient.finance.expenses.query({ boardId, year }),
  });
  const expenses = data?.data ?? [];

  const [date, setDate] = useState(`${year}-01-01`);
  const [category, setCategory] = useState("");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);

  const refresh = () =>
    queryClient.invalidateQueries({ queryKey: ["finance", boardId] });

  const handleAdd = async () => {
    setError(null);
    const amt = Number(amount);
    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
      category.trim() === "" ||
      !Number.isInteger(amt) ||
      amt < 0
    ) {
      setError(t("expenseInvalid"));
      return;
    }
    const res = await trpcClient.finance.addExpense.mutate({
      boardId,
      date,
      category: category.trim(),
      amount: amt,
      note: note.trim() || undefined,
    });
    if (res.success) {
      setCategory("");
      setAmount("");
      setNote("");
      refresh();
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm(t("expenseDeleteConfirm"))) return;
    const res = await trpcClient.finance.removeExpense.mutate({ id });
    if (res.success) refresh();
  };

  const total = expenses.reduce((sum, e) => sum + e.amount, 0);

  return (
    <div className={styles.panel}>
      <div className={styles.periodNav}>
        <button type="button" className={styles.navBtn} onClick={onPrev}>
          <CaretLeft size={14} />
        </button>
        <span className={styles.periodLabel}>{year}</span>
        <button type="button" className={styles.navBtn} onClick={onNext}>
          <CaretRight size={14} />
        </button>
      </div>

      <div className={styles.expenseForm}>
        <input
          type="date"
          className={styles.expenseInput}
          value={date}
          onChange={(e) => setDate(e.target.value)}
        />
        <input
          className={styles.expenseInput}
          value={category}
          placeholder={t("category")}
          onChange={(e) => setCategory(e.target.value)}
        />
        <input
          type="number"
          min={0}
          className={styles.expenseInput}
          value={amount}
          placeholder={t("amount")}
          onChange={(e) => setAmount(e.target.value)}
        />
        <input
          className={styles.expenseInput}
          value={note}
          placeholder={t("noteOptional")}
          onChange={(e) => setNote(e.target.value)}
        />
        <button type="button" className={styles.addBtn} onClick={handleAdd}>
          <Plus size={14} weight="bold" />
          {t("add")}
        </button>
      </div>
      {error ? <p className={styles.error}>{error}</p> : null}

      {isLoading ? (
        <p className={styles.empty}>{t("loading")}</p>
      ) : expenses.length === 0 ? (
        <p className={styles.empty}>{t("noExpenses")}</p>
      ) : (
        <ul className={styles.expenseList}>
          {expenses.map((e) => (
            <li key={e.id} className={styles.expenseRow}>
              <span className={styles.expenseDate}>{e.date}</span>
              <span className={styles.expenseCategory}>{e.category}</span>
              <span className={styles.expenseAmount}>{yen(e.amount)}</span>
              <span className={styles.expenseNote}>{e.note ?? ""}</span>
              <button
                type="button"
                className={styles.deleteBtn}
                onClick={() => handleDelete(e.id)}
                aria-label={t("delete")}
              >
                <Trash size={14} />
              </button>
            </li>
          ))}
        </ul>
      )}
      <p className={styles.totalLine}>
        {t("totalExpense")}: <strong>{yen(total)}</strong>
      </p>
    </div>
  );
}

// ── 収支タブ ─────────────────────────────────────────────────────
function SummaryTab({
  boardId,
  year,
  onPrev,
  onNext,
}: {
  boardId: string;
  year: number;
  onPrev: () => void;
  onNext: () => void;
}) {
  const t = useTranslations("boards.finance");
  const { data, isLoading } = useQuery({
    queryKey: ["finance", boardId, "summary", year],
    queryFn: () => trpcClient.finance.summary.query({ boardId, year }),
  });
  const summary = data?.data ?? null;
  const max = summary
    ? Math.max(1, ...summary.months.map((m) => Math.max(m.income, m.expense)))
    : 1;

  return (
    <div className={styles.panel}>
      <div className={styles.periodNav}>
        <button type="button" className={styles.navBtn} onClick={onPrev}>
          <CaretLeft size={14} />
        </button>
        <span className={styles.periodLabel}>{year}</span>
        <button type="button" className={styles.navBtn} onClick={onNext}>
          <CaretRight size={14} />
        </button>
      </div>

      {isLoading || !summary ? (
        <p className={styles.empty}>{t("loading")}</p>
      ) : (
        <>
          <div className={styles.totals}>
            <div className={styles.totalCard}>
              <span className={styles.totalLabel}>{t("income")}</span>
              <span className={styles.totalIncome}>
                {yen(summary.totalIncome)}
              </span>
            </div>
            <div className={styles.totalCard}>
              <span className={styles.totalLabel}>{t("expense")}</span>
              <span className={styles.totalExpense}>
                {yen(summary.totalExpense)}
              </span>
            </div>
            <div className={styles.totalCard}>
              <span className={styles.totalLabel}>{t("balance")}</span>
              <span className={styles.totalBalance}>
                {yen(summary.totalIncome - summary.totalExpense)}
              </span>
            </div>
          </div>

          <div className={styles.chart}>
            {summary.months.map((m) => (
              <div key={m.month} className={styles.chartCol}>
                <div className={styles.bars}>
                  <span
                    className={styles.barIncome}
                    style={{ height: `${(m.income / max) * 100}%` }}
                    title={`${t("income")}: ${yen(m.income)}`}
                  />
                  <span
                    className={styles.barExpense}
                    style={{ height: `${(m.expense / max) * 100}%` }}
                    title={`${t("expense")}: ${yen(m.expense)}`}
                  />
                </div>
                <span className={styles.chartLabel}>{m.month}</span>
              </div>
            ))}
          </div>
          <div className={styles.legend}>
            <span className={styles.legendIncome}>{t("income")}</span>
            <span className={styles.legendExpense}>{t("expense")}</span>
          </div>
        </>
      )}
    </div>
  );
}
