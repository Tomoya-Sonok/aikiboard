import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { ReactElement } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import messages from "@/translations/ja.json";
import { FeedView } from "./FeedView";

const listQuery = vi.fn();
const removeMutate = vi.fn(async () => ({ success: true }));
const createMutate = vi.fn(async () => ({ success: true, data: { id: "x" } }));
const listThreadsQuery = vi.fn(async () => ({ success: true, data: [] }));
const createThreadMutate = vi.fn(async () => ({
  success: true,
  data: { id: "t1" },
}));

vi.mock("@/lib/trpc/client", () => ({
  trpcClient: {
    boardPosts: {
      list: { query: (...a: unknown[]) => listQuery(...a) },
      remove: { mutate: (...a: unknown[]) => removeMutate(...a) },
      create: { mutate: (...a: unknown[]) => createMutate(...a) },
      createUploadUrl: { mutate: async () => ({ success: true, data: {} }) },
      aikinotePosts: { query: async () => ({ success: true, data: [] }) },
      listThreads: { query: (...a: unknown[]) => listThreadsQuery(...a) },
      createThread: { mutate: (...a: unknown[]) => createThreadMutate(...a) },
      removeThread: { mutate: async () => ({ success: true }) },
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
    createMutate.mockClear();
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

  it("「AikiNote にも流す」をチェックして投稿すると crossPostToAikinote を渡す", async () => {
    renderWithProviders(<FeedView boardId={BOARD_ID} />);

    await waitFor(() =>
      expect(screen.getByText("本日の稽古お疲れさまでした")).toBeTruthy(),
    );
    fireEvent.change(screen.getByPlaceholderText(/共有しましょう/), {
      target: { value: "クロスポストのテスト" },
    });
    fireEvent.click(
      screen.getByRole("checkbox", { name: "AikiNote にも流す" }),
    );
    fireEvent.click(screen.getByRole("button", { name: "投稿する" }));

    await waitFor(() =>
      expect(createMutate).toHaveBeenCalledWith(
        expect.objectContaining({
          boardId: BOARD_ID,
          body: "クロスポストのテスト",
          crossPostToAikinote: true,
        }),
      ),
    );
  });

  it("返信ボタンでスレッドを開き、返信を送信できる", async () => {
    listThreadsQuery.mockResolvedValue({ success: true, data: [] });
    renderWithProviders(<FeedView boardId={BOARD_ID} />);

    await waitFor(() =>
      expect(screen.getByText("本日の稽古お疲れさまでした")).toBeTruthy(),
    );
    // replyCount=2 の投稿の返信ボタン(「返信 2 件」)を押してスレッドを開く。
    fireEvent.click(screen.getByRole("button", { name: /返信 2 件/ }));

    await waitFor(() =>
      expect(listThreadsQuery).toHaveBeenCalledWith({
        postId: "00000000-0000-0000-0000-0000000000b1",
      }),
    );

    const dialog = await screen.findByRole("dialog");
    const textarea = within(dialog).getByPlaceholderText("返信を入力…");
    fireEvent.change(textarea, { target: { value: "了解しました" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "返信" }));

    await waitFor(() =>
      expect(createThreadMutate).toHaveBeenCalledWith({
        postId: "00000000-0000-0000-0000-0000000000b1",
        body: "了解しました",
      }),
    );
  });
});
