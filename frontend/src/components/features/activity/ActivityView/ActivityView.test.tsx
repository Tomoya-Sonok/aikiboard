import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { ReactElement } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import messages from "@/translations/ja.json";
import { ActivityView } from "./ActivityView";

const listQuery = vi.fn();

vi.mock("@/lib/trpc/client", () => ({
  trpcClient: {
    activityLogs: {
      list: { query: (...a: unknown[]) => listQuery(...a) },
    },
  },
}));

const BOARD_ID = "00000000-0000-0000-0000-0000000000aa";

const ITEMS = [
  {
    id: "1",
    action: "event.created",
    actorName: "道場長",
    title: "蕨市民体育館",
    targetType: "event",
    targetId: "e1",
    createdAt: "2026-06-01T10:00:00.000Z",
  },
  {
    id: "2",
    action: "announcement.published",
    actorName: "幹部",
    title: "審査案内",
    targetType: "announcement",
    targetId: "a1",
    createdAt: "2026-06-01T09:00:00.000Z",
  },
];

function renderWithProviders(ui: ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <NextIntlClientProvider locale="ja" messages={messages}>
        {ui}
      </NextIntlClientProvider>
    </QueryClientProvider>,
  );
}

describe("ActivityView", () => {
  beforeEach(() => {
    listQuery.mockResolvedValue({
      success: true,
      data: { items: ITEMS, total: 2, limit: 30, offset: 0 },
    });
  });

  it("操作履歴を日本語メッセージで表示する", async () => {
    renderWithProviders(<ActivityView boardId={BOARD_ID} />);

    await waitFor(() =>
      expect(screen.getByText("道場長 さんが稽古を追加しました")).toBeTruthy(),
    );
    expect(screen.getByText("幹部 さんがお知らせを公開しました")).toBeTruthy();
  });
});
