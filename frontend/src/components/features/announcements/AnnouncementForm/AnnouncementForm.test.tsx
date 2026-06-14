import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { ReactElement } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import messages from "@/translations/ja.json";
import { AnnouncementForm } from "./AnnouncementForm";

const createMutate = vi.fn(async () => ({
  success: true,
  data: { id: NEW_ID },
}));
const updateMutate = vi.fn(async () => ({ success: true }));
const publishMutate = vi.fn(async () => ({ success: true }));

vi.mock("@/lib/trpc/client", () => ({
  trpcClient: {
    announcements: {
      create: { mutate: (...a: unknown[]) => createMutate(...a) },
      update: { mutate: (...a: unknown[]) => updateMutate(...a) },
      publish: { mutate: (...a: unknown[]) => publishMutate(...a) },
    },
  },
}));

// Tiptap は test 環境(happy-dom)で不安定なため、本文エディタはスタブに差し替える。
vi.mock("@/components/shared/RichTextEditor/RichTextEditor", () => ({
  RichTextEditor: () => null,
}));

const NEW_ID = "00000000-0000-0000-0000-0000000000cc";
const BOARD_ID = "00000000-0000-0000-0000-0000000000bb";
const ANN_ID = "00000000-0000-0000-0000-0000000000aa";

function renderWithProviders(ui: ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: { mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <NextIntlClientProvider locale="ja" messages={messages}>
        {ui}
      </NextIntlClientProvider>
    </QueryClientProvider>,
  );
}

describe("AnnouncementForm", () => {
  beforeEach(() => {
    createMutate.mockClear();
    updateMutate.mockClear();
    publishMutate.mockClear();
    vi.restoreAllMocks();
  });

  it("下書き保存は create のみ呼び publish しない", async () => {
    // Arrange
    renderWithProviders(
      <AnnouncementForm
        boardId={BOARD_ID}
        open
        onClose={() => {}}
        onSaved={() => {}}
      />,
    );
    fireEvent.change(screen.getByLabelText(/タイトル/), {
      target: { value: "審査案内" },
    });

    // Act
    fireEvent.click(screen.getByRole("button", { name: "下書き保存" }));

    // Assert
    await waitFor(() => expect(createMutate).toHaveBeenCalledTimes(1));
    expect(publishMutate).not.toHaveBeenCalled();
  });

  it("公開するは確認後に create → publish を呼ぶ", async () => {
    // Arrange
    vi.spyOn(window, "confirm").mockReturnValue(true);
    renderWithProviders(
      <AnnouncementForm
        boardId={BOARD_ID}
        open
        onClose={() => {}}
        onSaved={() => {}}
      />,
    );
    fireEvent.change(screen.getByLabelText(/タイトル/), {
      target: { value: "審査案内" },
    });

    // Act
    fireEvent.click(screen.getByRole("button", { name: "公開する" }));

    // Assert
    await waitFor(() =>
      expect(publishMutate).toHaveBeenCalledWith({ id: NEW_ID }),
    );
    expect(createMutate).toHaveBeenCalledTimes(1);
  });

  it("公開の確認をキャンセルすると何も呼ばない", async () => {
    // Arrange
    vi.spyOn(window, "confirm").mockReturnValue(false);
    renderWithProviders(
      <AnnouncementForm
        boardId={BOARD_ID}
        open
        onClose={() => {}}
        onSaved={() => {}}
      />,
    );
    fireEvent.change(screen.getByLabelText(/タイトル/), {
      target: { value: "審査案内" },
    });

    // Act
    fireEvent.click(screen.getByRole("button", { name: "公開する" }));

    // Assert
    await waitFor(() => expect(window.confirm).toHaveBeenCalled());
    expect(createMutate).not.toHaveBeenCalled();
    expect(publishMutate).not.toHaveBeenCalled();
  });

  it("タイトル未入力では保存しない", async () => {
    // Arrange
    renderWithProviders(
      <AnnouncementForm
        boardId={BOARD_ID}
        open
        onClose={() => {}}
        onSaved={() => {}}
      />,
    );

    // Act
    fireEvent.click(screen.getByRole("button", { name: "下書き保存" }));

    // Assert
    expect(await screen.findByText("タイトルを入力してください")).toBeTruthy();
    expect(createMutate).not.toHaveBeenCalled();
  });

  it("公開済みの編集は update のみ(publish しない)", async () => {
    // Arrange
    renderWithProviders(
      <AnnouncementForm
        boardId={BOARD_ID}
        editing={{
          id: ANN_ID,
          title: "既存タイトル",
          bodyRich: { type: "doc", content: [] },
          notifyEmail: false,
          isDraft: false,
        }}
        open
        onClose={() => {}}
        onSaved={() => {}}
      />,
    );

    // Act
    fireEvent.click(screen.getByRole("button", { name: "保存" }));

    // Assert
    await waitFor(() => expect(updateMutate).toHaveBeenCalledTimes(1));
    expect(publishMutate).not.toHaveBeenCalled();
    expect(createMutate).not.toHaveBeenCalled();
  });
});
