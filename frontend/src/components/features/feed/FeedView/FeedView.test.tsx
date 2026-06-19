import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { ReactElement } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import messages from "@/translations/ja.json";
import { FeedView } from "./FeedView";

const listQuery = vi.fn();
const removeMutate = vi.fn(async () => ({ success: true }));

vi.mock("@/lib/trpc/client", () => ({
  trpcClient: {
    boardPosts: {
      list: { query: (...a: unknown[]) => listQuery(...a) },
      remove: { mutate: (...a: unknown[]) => removeMutate(...a) },
      create: { mutate: async () => ({ success: true, data: { id: "x" } }) },
      createUploadUrl: { mutate: async () => ({ success: true, data: {} }) },
    },
  },
}));

vi.mock("@/lib/hooks/useAuth", () => ({
  useAuth: () => ({ user: { id: "u-1", username: "門人" } }),
}));

const BOARD_ID = "00000000-0000-0000-0000-0000000000aa";

const POSTS = [
  {
    id: "00000000-0000-0000-0000-0000000000b1",
    body: "本日の稽古お疲れさまでした",
    author: { userId: "u-1", username: "門人", profileImageUrl: null },
    attachments: [],
    replyCount: 2,
    crossPostToAikinote: false,
    syncedFromPostId: null,
    createdAt: "2026-06-01T10:00:00.000Z",
    canDelete: true,
  },
  {
    id: "00000000-0000-0000-0000-0000000000b2",
    body: "他の人の投稿",
    author: { userId: "u-2", username: "道場長", profileImageUrl: null },
    attachments: [],
    replyCount: 0,
    crossPostToAikinote: false,
    syncedFromPostId: null,
    createdAt: "2026-06-01T09:00:00.000Z",
    canDelete: false,
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

describe("FeedView", () => {
  beforeEach(() => {
    listQuery.mockResolvedValue({
      success: true,
      data: { items: POSTS, total: 2, limit: 20, offset: 0 },
    });
    removeMutate.mockClear();
  });

  it("投稿一覧を著者名つきで表示する", async () => {
    renderWithProviders(<FeedView boardId={BOARD_ID} />);

    await waitFor(() =>
      expect(screen.getByText("本日の稽古お疲れさまでした")).toBeTruthy(),
    );
    expect(screen.getByText("道場長")).toBeTruthy();
  });

  it("削除メニューは canDelete の投稿のみに出る", async () => {
    renderWithProviders(<FeedView boardId={BOARD_ID} />);

    await waitFor(() => expect(screen.getByText("他の人の投稿")).toBeTruthy());
    // canDelete=true の 1 件のみメニュー(•••)ボタンが出る。
    expect(screen.getAllByRole("button", { name: "メニュー" })).toHaveLength(1);
  });

  it("削除メニュー → 削除 で確認後に remove を呼ぶ", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    renderWithProviders(<FeedView boardId={BOARD_ID} />);

    await waitFor(() => expect(screen.getByText("他の人の投稿")).toBeTruthy());
    fireEvent.click(screen.getByRole("button", { name: "メニュー" }));
    fireEvent.click(screen.getByRole("button", { name: "削除" }));

    await waitFor(() =>
      expect(removeMutate).toHaveBeenCalledWith({
        id: "00000000-0000-0000-0000-0000000000b1",
      }),
    );
  });
});
