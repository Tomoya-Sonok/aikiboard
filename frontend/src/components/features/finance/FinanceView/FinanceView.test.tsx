import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { ReactElement } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import messages from "@/translations/ja.json";
import { FinanceView } from "./FinanceView";

const paymentsQuery = vi.fn();
const setPaymentMutate = vi.fn(async () => ({ success: true }));
const setFeeMutate = vi.fn(async () => ({ success: true }));
const expensesQuery = vi.fn(async () => ({ success: true, data: [] }));
const summaryQuery = vi.fn(async () => ({
  success: true,
  data: { year: 2026, months: [], totalIncome: 0, totalExpense: 0 },
}));

vi.mock("@/lib/trpc/client", () => ({
  trpcClient: {
    finance: {
      payments: { query: (...a: unknown[]) => paymentsQuery(...a) },
      setPayment: { mutate: (...a: unknown[]) => setPaymentMutate(...a) },
      setFee: { mutate: (...a: unknown[]) => setFeeMutate(...a) },
      expenses: { query: (...a: unknown[]) => expensesQuery(...a) },
      addExpense: {
        mutate: async () => ({ success: true, data: { id: "e" } }),
      },
      removeExpense: { mutate: async () => ({ success: true }) },
      summary: { query: (...a: unknown[]) => summaryQuery(...a) },
    },
  },
}));

const BOARD_ID = "00000000-0000-0000-0000-0000000000aa";
const U1 = "00000000-0000-0000-0000-0000000000b1";

function renderWithProviders(ui: ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <NextIntlClientProvider locale="ja" messages={messages}>
        {ui}
      </NextIntlClientProvider>
    </QueryClientProvider>,
  );
}

describe("FinanceView", () => {
  beforeEach(() => {
    paymentsQuery.mockResolvedValue({
      success: true,
      data: [
        {
          userId: U1,
          username: "門人",
          profileImageUrl: null,
          monthlyFee: 5000,
          status: "unpaid",
        },
      ],
    });
    setPaymentMutate.mockClear();
  });

  it("月謝ロスターを表示する", async () => {
    renderWithProviders(<FinanceView boardId={BOARD_ID} />);

    await waitFor(() => expect(screen.getByText("門人")).toBeTruthy());
    expect(screen.getByDisplayValue("5000")).toBeTruthy();
  });

  it("支払ステータスを変更すると setPayment を呼ぶ", async () => {
    renderWithProviders(<FinanceView boardId={BOARD_ID} />);

    await waitFor(() => expect(screen.getByText("門人")).toBeTruthy());
    const select = screen.getByRole("combobox");
    fireEvent.change(select, { target: { value: "paid" } });

    await waitFor(() =>
      expect(setPaymentMutate).toHaveBeenCalledWith(
        expect.objectContaining({ userId: U1, status: "paid" }),
      ),
    );
  });

  it("収支タブに切り替えると summary を引く", async () => {
    renderWithProviders(<FinanceView boardId={BOARD_ID} />);

    fireEvent.click(screen.getByRole("button", { name: "収支" }));

    await waitFor(() => expect(summaryQuery).toHaveBeenCalled());
  });
});
