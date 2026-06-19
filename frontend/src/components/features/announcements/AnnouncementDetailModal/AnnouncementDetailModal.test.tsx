import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { ReactElement } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AnnouncementSummary } from "@/lib/types/announcement";
import messages from "@/translations/ja.json";
import { AnnouncementDetailModal } from "./AnnouncementDetailModal";

const detailQuery = vi.fn(async () => ({
  success: true,
  data: {
    id: ANN_ID,
    title: "審査案内",
    bodyRich: {
      type: "doc",
      content: [
        { type: "paragraph", content: [{ type: "text", text: "本文です" }] },
      ],
    },
    notifyEmail: false,
    authorName: "道場長",
    publishedAt: "2026-06-01T00:00:00.000Z",
    createdAt: "2026-06-01T00:00:00.000Z",
    isDraft: false,
    isRead: false,
  },
}));
const markReadMutate = vi.fn(async () => ({ success: true }));

vi.mock("@/lib/trpc/client", () => ({
  trpcClient: {
    announcements: {
      detail: { query: (...args: unknown[]) => detailQuery(...args) },
      markRead: { mutate: (...args: unknown[]) => markReadMutate(...args) },
    },
  },
}));

const ANN_ID = "00000000-0000-0000-0000-0000000000aa";
const BOARD_ID = "00000000-0000-0000-0000-0000000000bb";

function renderWithProviders(ui: ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: { mutations: { retry: false }, queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <NextIntlClientProvider locale="ja" messages={messages}>
        {ui}
      </NextIntlClientProvider>
    </QueryClientProvider>,
  );
}

const baseSummary: AnnouncementSummary = {
  id: ANN_ID,
  title: "審査案内",
  excerpt: "本文です",
  notifyEmail: false,
  authorName: "道場長",
  publishedAt: "2026-06-01T00:00:00.000Z",
  createdAt: "2026-06-01T00:00:00.000Z",
  isDraft: false,
  isRead: false,
};

describe("AnnouncementDetailModal", () => {
  beforeEach(() => {
    detailQuery.mockClear();
    markReadMutate.mockClear();
  });

  it("公開済みかつ未読を開くと既読 mutation が飛ぶ", async () => {
    // Arrange / Act
    renderWithProviders(
      <AnnouncementDetailModal
        boardId={BOARD_ID}
        summary={baseSummary}
        open
        onClose={() => {}}
      />,
    );

    // Assert
    await waitFor(() =>
      expect(markReadMutate).toHaveBeenCalledWith({ id: ANN_ID }),
    );
  });

  it("既読のものを開いても既読 mutation は飛ばない", async () => {
    // Arrange / Act
    renderWithProviders(
      <AnnouncementDetailModal
        boardId={BOARD_ID}
        summary={{ ...baseSummary, isRead: true }}
        open
        onClose={() => {}}
      />,
    );

    // Assert(本文が出るまで待ってから未呼び出しを確認)
    await waitFor(() => expect(screen.getByText("本文です")).toBeTruthy());
    expect(markReadMutate).not.toHaveBeenCalled();
  });

  it("下書きを開いても既読 mutation は飛ばない", async () => {
    // Arrange / Act
    renderWithProviders(
      <AnnouncementDetailModal
        boardId={BOARD_ID}
        summary={{ ...baseSummary, isDraft: true, publishedAt: null }}
        open
        onClose={() => {}}
      />,
    );

    // Assert
    await waitFor(() => expect(screen.getByText("本文です")).toBeTruthy());
    expect(markReadMutate).not.toHaveBeenCalled();
  });
});
