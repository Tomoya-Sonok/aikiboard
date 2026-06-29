import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { ReactElement } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import messages from "@/translations/ja.json";
import { ArchiveView } from "./ArchiveView";

const listQuery = vi.fn();
const detailQuery = vi.fn();
const searchQuery = vi.fn(async () => ({ success: true, data: [] }));

vi.mock("@/lib/trpc/client", () => ({
  trpcClient: {
    archives: {
      list: { query: (...a: unknown[]) => listQuery(...a) },
      detail: { query: (...a: unknown[]) => detailQuery(...a) },
      search: { query: (...a: unknown[]) => searchQuery(...a) },
    },
  },
}));

const BOARD_ID = "00000000-0000-0000-0000-0000000000aa";
const A1 = "00000000-0000-0000-0000-0000000000b1";
const A2 = "00000000-0000-0000-0000-0000000000b2";

const NODES = [
  {
    id: A1,
    parentId: null,
    title: "稽古記録",
    orderIndex: 0,
    createdAt: "2026-06-01T00:00:00.000Z",
  },
  {
    id: A2,
    parentId: A1,
    title: "2026年6月",
    orderIndex: 0,
    createdAt: "2026-06-02T00:00:00.000Z",
  },
];

const DETAIL = {
  id: A1,
  parentId: null,
  title: "稽古記録",
  bodyRich: {
    type: "doc",
    content: [
      {
        type: "paragraph",
        content: [{ type: "text", text: "本日の稽古内容" }],
      },
    ],
  },
  createdAt: "2026-06-01T00:00:00.000Z",
  attachments: [],
};

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

describe("ArchiveView", () => {
  beforeEach(() => {
    listQuery.mockResolvedValue({ success: true, data: NODES });
    detailQuery.mockResolvedValue({ success: true, data: DETAIL });
  });

  it("親子ツリーを表示する", async () => {
    renderWithProviders(<ArchiveView boardId={BOARD_ID} canManage={false} />);

    await waitFor(() => expect(screen.getByText("稽古記録")).toBeTruthy());
    expect(screen.getByText("2026年6月")).toBeTruthy();
  });

  it("ページを選ぶと本文を表示する", async () => {
    renderWithProviders(<ArchiveView boardId={BOARD_ID} canManage={false} />);

    await waitFor(() => expect(screen.getByText("稽古記録")).toBeTruthy());
    fireEvent.click(screen.getByText("稽古記録"));

    await waitFor(() => expect(detailQuery).toHaveBeenCalledWith({ id: A1 }));
    await waitFor(() =>
      expect(screen.getByText("本日の稽古内容")).toBeTruthy(),
    );
  });

  it("canManage=false では新規ページボタンを出さない", async () => {
    renderWithProviders(<ArchiveView boardId={BOARD_ID} canManage={false} />);

    await waitFor(() => expect(screen.getByText("稽古記録")).toBeTruthy());
    expect(screen.queryByRole("button", { name: "新規ページ" })).toBeNull();
  });
});
