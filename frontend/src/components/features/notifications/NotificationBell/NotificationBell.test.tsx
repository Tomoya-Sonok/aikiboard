import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { ReactElement } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import messages from "@/translations/ja.json";
import { NotificationBell } from "./NotificationBell";

const unreadQuery = vi.fn();
const listQuery = vi.fn();
const markReadMutate = vi.fn(async () => ({ success: true }));
const markAllReadMutate = vi.fn(async () => ({ success: true }));

vi.mock("@/lib/trpc/client", () => ({
  trpcClient: {
    notifications: {
      unreadCount: { query: (...a: unknown[]) => unreadQuery(...a) },
      list: { query: (...a: unknown[]) => listQuery(...a) },
      markRead: { mutate: (...a: unknown[]) => markReadMutate(...a) },
      markAllRead: { mutate: (...a: unknown[]) => markAllReadMutate(...a) },
    },
  },
}));

const BOARD_ID = "00000000-0000-0000-0000-0000000000aa";
const NOTI_ID = "00000000-0000-0000-0000-0000000000bb";

const ITEMS = [
  {
    id: NOTI_ID,
    type: "thread.replied",
    targetType: "post",
    targetId: "p1",
    actorName: "門人",
    title: "ありがとうございます",
    isRead: false,
    createdAt: "2026-06-01T00:00:00.000Z",
  },
];

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

describe("NotificationBell", () => {
  beforeEach(() => {
    unreadQuery.mockResolvedValue({ success: true, data: { count: 2 } });
    listQuery.mockResolvedValue({
      success: true,
      data: { items: ITEMS, total: 1, limit: 20, offset: 0 },
    });
    markReadMutate.mockClear();
    markAllReadMutate.mockClear();
  });

  it("未読数バッジを表示する", async () => {
    renderWithProviders(<NotificationBell boardId={BOARD_ID} slug="dojo" />);

    await waitFor(() => expect(screen.getByText("2")).toBeTruthy());
  });

  it("ベルを開くと通知一覧を表示する", async () => {
    renderWithProviders(<NotificationBell boardId={BOARD_ID} slug="dojo" />);

    fireEvent.click(screen.getByRole("button", { name: "通知" }));

    await waitFor(() =>
      expect(
        screen.getByText("門人 さんがあなたの投稿に返信しました"),
      ).toBeTruthy(),
    );
  });

  it("未読通知をクリックすると既読化する", async () => {
    renderWithProviders(<NotificationBell boardId={BOARD_ID} slug="dojo" />);
    fireEvent.click(screen.getByRole("button", { name: "通知" }));

    const item = await screen.findByText(
      "門人 さんがあなたの投稿に返信しました",
    );
    fireEvent.click(item);

    await waitFor(() =>
      expect(markReadMutate).toHaveBeenCalledWith({ id: NOTI_ID }),
    );
  });

  it("すべて既読を押すと markAllRead を呼ぶ", async () => {
    renderWithProviders(<NotificationBell boardId={BOARD_ID} slug="dojo" />);
    fireEvent.click(screen.getByRole("button", { name: "通知" }));

    fireEvent.click(await screen.findByRole("button", { name: "すべて既読" }));

    await waitFor(() =>
      expect(markAllReadMutate).toHaveBeenCalledWith({ boardId: BOARD_ID }),
    );
  });
});
