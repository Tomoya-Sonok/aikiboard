import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { ReactElement } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import messages from "@/translations/ja.json";
import { TodoView } from "./TodoView";

const listQuery = vi.fn();
const assigneesQuery = vi.fn(async () => ({
  success: true,
  data: [
    { userId: "u-a", role: "admin", username: "幹部", profileImageUrl: null },
  ],
}));
const updateMutate = vi.fn(async () => ({ success: true }));

vi.mock("@/lib/trpc/client", () => ({
  trpcClient: {
    boardTodos: {
      list: { query: (...a: unknown[]) => listQuery(...a) },
      assignees: { query: (...a: unknown[]) => assigneesQuery(...a) },
      update: { mutate: (...a: unknown[]) => updateMutate(...a) },
      create: { mutate: async () => ({ success: true, data: { id: "x" } }) },
      remove: { mutate: async () => ({ success: true }) },
    },
  },
}));

const BOARD_ID = "00000000-0000-0000-0000-0000000000aa";
const TODO_ID = "00000000-0000-0000-0000-0000000000b1";

const TODOS = [
  {
    id: TODO_ID,
    title: "体育館の鍵を返却",
    status: "todo",
    note: "受付に返す",
    dueDate: "2026-07-10",
    createdAt: "2026-06-01T00:00:00.000Z",
    assignee: { userId: "u-a", username: "幹部", profileImageUrl: null },
  },
];

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

describe("TodoView", () => {
  beforeEach(() => {
    listQuery.mockResolvedValue({ success: true, data: TODOS });
    updateMutate.mockClear();
  });

  it("Todo を担当者つきで表示する", async () => {
    renderWithProviders(<TodoView boardId={BOARD_ID} />);

    await waitFor(() =>
      expect(screen.getByText("体育館の鍵を返却")).toBeTruthy(),
    );
    expect(screen.getByText("幹部")).toBeTruthy();
  });

  it("ステータスを変更すると update を呼ぶ", async () => {
    renderWithProviders(<TodoView boardId={BOARD_ID} />);

    await waitFor(() =>
      expect(screen.getByText("体育館の鍵を返却")).toBeTruthy(),
    );
    const select = screen.getByRole("combobox", { name: "ステータスを変更" });
    fireEvent.change(select, { target: { value: "done" } });

    await waitFor(() =>
      expect(updateMutate).toHaveBeenCalledWith({
        id: TODO_ID,
        status: "done",
      }),
    );
  });
});
