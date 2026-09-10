import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { ReactElement } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import messages from "@/translations/ja.json";
import { SettingsView } from "./SettingsView";

const settingsQuery = vi.fn();
const deletionSummaryQuery = vi.fn();
const removeMutate = vi.fn(async () => ({ success: true }));
const replaceMock = vi.fn();

vi.mock("@/lib/trpc/client", () => ({
  trpcClient: {
    boardSettings: {
      get: { query: (...a: unknown[]) => settingsQuery(...a) },
      update: { mutate: async () => ({ success: true }) },
    },
    boards: {
      deletionSummary: {
        query: (...a: unknown[]) => deletionSummaryQuery(...a),
      },
      remove: { mutate: (...a: unknown[]) => removeMutate(...a) },
    },
  },
}));

vi.mock("@/lib/i18n/routing", async () => {
  const actual =
    await vi.importActual<typeof import("@/lib/i18n/routing")>(
      "@/lib/i18n/routing",
    );
  return { ...actual, useRouter: () => ({ replace: replaceMock }) };
});

const BOARD_ID = "00000000-0000-0000-0000-0000000000aa";
const BOARD_NAME = "蕨道場 一般稽古";

const SETTINGS = {
  isPublic: false,
  themeColorCode: "sumi",
  logoUrl: null,
  description: null,
  publicPageConfig: {},
};

const SUMMARY = {
  memberCount: 12,
  postCount: 34,
  eventCount: 56,
  announcementCount: 7,
  archiveCount: 8,
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

describe("SettingsView のボード削除", () => {
  beforeEach(() => {
    settingsQuery.mockResolvedValue({ success: true, data: SETTINGS });
    deletionSummaryQuery.mockResolvedValue({ success: true, data: SUMMARY });
    removeMutate.mockClear();
    replaceMock.mockClear();
  });

  it("owner には危険な操作セクションが出る", async () => {
    renderWithProviders(
      <SettingsView
        boardId={BOARD_ID}
        slug="general"
        boardName={BOARD_NAME}
        viewerRole="owner"
      />,
    );

    await waitFor(() => expect(screen.getByText("危険な操作")).toBeTruthy());
    expect(
      screen.getByRole("button", { name: "このボードを削除" }),
    ).toBeTruthy();
  });

  it("admin には危険な操作セクションが出ない", async () => {
    renderWithProviders(
      <SettingsView
        boardId={BOARD_ID}
        slug="general"
        boardName={BOARD_NAME}
        viewerRole="admin"
      />,
    );

    await waitFor(() => expect(screen.getByText("ボード設定")).toBeTruthy());
    expect(screen.queryByText("危険な操作")).toBeNull();
  });

  it("ボード名が一致するまで削除ボタンは押せない", async () => {
    renderWithProviders(
      <SettingsView
        boardId={BOARD_ID}
        slug="general"
        boardName={BOARD_NAME}
        viewerRole="owner"
      />,
    );

    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "このボードを削除" }),
      ).toBeTruthy(),
    );
    fireEvent.click(screen.getByRole("button", { name: "このボードを削除" }));

    // ダイアログが開き、削除ボタンは無効。
    const confirmButton = await screen.findByRole("button", {
      name: "完全に削除する",
    });
    expect(confirmButton.hasAttribute("disabled")).toBe(true);

    // 名前が違う入力では有効化されない。
    const input = screen.getByLabelText(/確認のため/);
    fireEvent.change(input, { target: { value: "違う名前" } });
    expect(confirmButton.hasAttribute("disabled")).toBe(true);

    // 完全一致で有効化される。
    fireEvent.change(input, { target: { value: BOARD_NAME } });
    expect(confirmButton.hasAttribute("disabled")).toBe(false);
  });

  it("削除ダイアログに削除対象の集計が出る", async () => {
    renderWithProviders(
      <SettingsView
        boardId={BOARD_ID}
        slug="general"
        boardName={BOARD_NAME}
        viewerRole="owner"
      />,
    );

    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "このボードを削除" }),
      ).toBeTruthy(),
    );
    fireEvent.click(screen.getByRole("button", { name: "このボードを削除" }));

    await waitFor(() =>
      expect(screen.getByText("メンバー 12 名")).toBeTruthy(),
    );
    expect(screen.getByText("投稿 34 件")).toBeTruthy();
    expect(screen.getByText("稽古 56 件")).toBeTruthy();
  });

  it("名前一致後に削除を実行するとホームへ遷移する", async () => {
    renderWithProviders(
      <SettingsView
        boardId={BOARD_ID}
        slug="general"
        boardName={BOARD_NAME}
        viewerRole="owner"
      />,
    );

    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "このボードを削除" }),
      ).toBeTruthy(),
    );
    fireEvent.click(screen.getByRole("button", { name: "このボードを削除" }));

    const input = await screen.findByLabelText(/確認のため/);
    fireEvent.change(input, { target: { value: BOARD_NAME } });
    fireEvent.click(screen.getByRole("button", { name: "完全に削除する" }));

    await waitFor(() =>
      expect(removeMutate).toHaveBeenCalledWith({ boardId: BOARD_ID }),
    );
    await waitFor(() => expect(replaceMock).toHaveBeenCalledWith("/home"));
  });
});
