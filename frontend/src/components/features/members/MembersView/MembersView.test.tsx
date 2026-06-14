import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { ReactElement } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import messages from "@/translations/ja.json";
import { MembersView } from "./MembersView";

const listQuery = vi.fn();
const removeMutate = vi.fn(async () => ({ success: true }));
const leaveMutate = vi.fn(async () => ({ success: true }));

vi.mock("@/lib/trpc/client", () => ({
  trpcClient: {
    members: {
      list: { query: (...a: unknown[]) => listQuery(...a) },
      remove: { mutate: (...a: unknown[]) => removeMutate(...a) },
      leave: { mutate: (...a: unknown[]) => leaveMutate(...a) },
    },
    // InviteLinkPanel が使う(admin 描画時)。
    invitations: {
      list: { query: async () => ({ success: true, data: [] }) },
      create: { mutate: async () => ({ success: true }) },
      revoke: { mutate: async () => ({ success: true }) },
    },
  },
}));

let viewerId = "u-admin";
vi.mock("@/lib/hooks/useAuth", () => ({
  useAuth: () => ({ user: { id: viewerId } }),
}));

const BOARD_ID = "00000000-0000-0000-0000-0000000000aa";

const MEMBERS = [
  {
    userId: "u-owner",
    username: "道場長",
    profileImageUrl: null,
    role: "owner",
    joinedAt: "2026-01-01T00:00:00Z",
  },
  {
    userId: "u-admin",
    username: "幹部",
    profileImageUrl: null,
    role: "admin",
    joinedAt: "2026-01-02T00:00:00Z",
  },
  {
    userId: "u-member",
    username: "門人",
    profileImageUrl: null,
    role: "member",
    joinedAt: "2026-01-03T00:00:00Z",
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

describe("MembersView", () => {
  beforeEach(() => {
    listQuery.mockResolvedValue({ success: true, data: MEMBERS });
    removeMutate.mockClear();
    leaveMutate.mockClear();
    viewerId = "u-admin";
  });

  it("admin には owner・自分以外のメンバーに削除ボタンが出る", async () => {
    renderWithProviders(<MembersView boardId={BOARD_ID} canManage />);

    await waitFor(() => expect(screen.getByText("門人")).toBeTruthy());
    // 削除は門人(member)の 1 件だけ。
    expect(screen.getAllByRole("button", { name: "削除" })).toHaveLength(1);
  });

  it("member 閲覧時は削除ボタンが出ない", async () => {
    viewerId = "u-member";
    renderWithProviders(<MembersView boardId={BOARD_ID} canManage={false} />);

    await waitFor(() => expect(screen.getByText("門人")).toBeTruthy());
    expect(screen.queryByRole("button", { name: "削除" })).toBeNull();
  });

  it("削除ボタンを押すと確認後に remove を呼ぶ", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    renderWithProviders(<MembersView boardId={BOARD_ID} canManage />);

    await waitFor(() => expect(screen.getByText("門人")).toBeTruthy());
    fireEvent.click(screen.getByRole("button", { name: "削除" }));

    await waitFor(() =>
      expect(removeMutate).toHaveBeenCalledWith({
        boardId: BOARD_ID,
        userId: "u-member",
      }),
    );
  });

  it("自分(owner 以外)には退会ボタンが出る", async () => {
    viewerId = "u-member";
    renderWithProviders(<MembersView boardId={BOARD_ID} canManage={false} />);

    await waitFor(() => expect(screen.getByText("門人")).toBeTruthy());
    expect(screen.getByRole("button", { name: "退会" })).toBeTruthy();
  });
});
