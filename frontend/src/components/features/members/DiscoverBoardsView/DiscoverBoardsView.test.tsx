import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { ReactElement } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import messages from "@/translations/ja.json";
import { DiscoverBoardsView } from "./DiscoverBoardsView";

const discoverableQuery = vi.fn();
const createMutate = vi.fn(async () => ({ success: true, data: { id: "r1" } }));

vi.mock("@/lib/trpc/client", () => ({
  trpcClient: {
    membershipRequests: {
      discoverable: { query: (...a: unknown[]) => discoverableQuery(...a) },
      create: { mutate: (...a: unknown[]) => createMutate(...a) },
    },
  },
}));

const BOARD = {
  id: "00000000-0000-0000-0000-0000000000aa",
  name: "蕨合気道会",
  slug: "warabi",
  isPublic: true,
  memberCount: 12,
  requestStatus: null as "pending" | "rejected" | null,
};

function renderWithProviders(ui: ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: {
      mutations: { retry: false },
      queries: { retry: false },
    },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <NextIntlClientProvider locale="ja" messages={messages}>
        {ui}
      </NextIntlClientProvider>
    </QueryClientProvider>,
  );
}

describe("DiscoverBoardsView", () => {
  beforeEach(() => {
    createMutate.mockClear();
  });

  it("申請ボタンからダイアログ送信で create を呼ぶ", async () => {
    discoverableQuery.mockResolvedValue({ success: true, data: [BOARD] });
    renderWithProviders(<DiscoverBoardsView />);

    await waitFor(() => expect(screen.getByText("蕨合気道会")).toBeTruthy());

    // 一覧の「参加を申請」→ ダイアログの「申請する」。
    fireEvent.click(screen.getByRole("button", { name: "参加を申請" }));
    fireEvent.click(screen.getByRole("button", { name: "申請する" }));

    await waitFor(() =>
      expect(createMutate).toHaveBeenCalledWith(
        expect.objectContaining({ boardId: BOARD.id }),
      ),
    );
  });

  it("申請中のボードは申請ボタンを出さない", async () => {
    discoverableQuery.mockResolvedValue({
      success: true,
      data: [{ ...BOARD, requestStatus: "pending" }],
    });
    renderWithProviders(<DiscoverBoardsView />);

    await waitFor(() => expect(screen.getByText("蕨合気道会")).toBeTruthy());
    expect(screen.queryByRole("button", { name: "参加を申請" })).toBeNull();
    expect(screen.getByText("申請中")).toBeTruthy();
  });

  it("発見できるボードが無ければ空状態を表示する", async () => {
    discoverableQuery.mockResolvedValue({ success: true, data: [] });
    renderWithProviders(<DiscoverBoardsView />);

    await waitFor(() =>
      expect(
        screen.getByText(/参加できる道場ボードが見つかりませんでした/),
      ).toBeTruthy(),
    );
  });
});
