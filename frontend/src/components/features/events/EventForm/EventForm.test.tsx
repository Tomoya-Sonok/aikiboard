import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { ReactElement } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import messages from "@/translations/ja.json";
import { EventForm } from "./EventForm";

const createMutate = vi.fn(async () => ({ success: true }));

vi.mock("@/lib/trpc/client", () => ({
  trpcClient: {
    events: {
      create: { mutate: (...args: unknown[]) => createMutate(...args) },
      update: { mutate: vi.fn(async () => ({ success: true })) },
      overrideOccurrence: { mutate: vi.fn(async () => ({ success: true })) },
    },
  },
}));

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

describe("EventForm(作成)", () => {
  beforeEach(() => {
    createMutate.mockClear();
  });

  it("日付・時刻を JST の ISO instant にして作成する(繰り返しなし)", async () => {
    // Arrange
    renderWithProviders(
      <EventForm
        open
        onClose={() => {}}
        onSaved={() => {}}
        boardId="00000000-0000-0000-0000-0000000000aa"
        mode="create"
        defaultDate="2026-06-01"
      />,
    );

    // Act
    fireEvent.change(screen.getByLabelText("場所"), {
      target: { value: "本部道場" },
    });
    fireEvent.click(screen.getByRole("button", { name: "作成" }));

    // Assert(19:00–21:00 JST = 10:00–12:00Z、recurrence は null)
    await waitFor(() => expect(createMutate).toHaveBeenCalledTimes(1));
    expect(createMutate).toHaveBeenCalledWith(
      expect.objectContaining({
        boardId: "00000000-0000-0000-0000-0000000000aa",
        startAt: "2026-06-01T10:00:00.000Z",
        endAt: "2026-06-01T12:00:00.000Z",
        place: "本部道場",
        isPublic: true,
        recurrence: null,
      }),
    );
  });

  it("毎週 + 曜日を選ぶと recurrence を載せる", async () => {
    // Arrange
    renderWithProviders(
      <EventForm
        open
        onClose={() => {}}
        onSaved={() => {}}
        boardId="00000000-0000-0000-0000-0000000000aa"
        mode="create"
        defaultDate="2026-06-01"
      />,
    );

    // Act
    fireEvent.change(screen.getByLabelText("場所"), {
      target: { value: "本部道場" },
    });
    fireEvent.change(screen.getByLabelText("繰り返しの種類"), {
      target: { value: "WEEKLY" },
    });
    // 月曜にチェック
    fireEvent.click(screen.getByLabelText("月"));
    fireEvent.click(screen.getByRole("button", { name: "作成" }));

    // Assert
    await waitFor(() => expect(createMutate).toHaveBeenCalledTimes(1));
    expect(createMutate).toHaveBeenCalledWith(
      expect.objectContaining({
        recurrence: expect.objectContaining({
          freq: "WEEKLY",
          byweekday: ["MO"],
        }),
      }),
    );
  });

  it("場所が空なら作成しない(バリデーション)", async () => {
    // Arrange
    renderWithProviders(
      <EventForm
        open
        onClose={() => {}}
        onSaved={() => {}}
        boardId="00000000-0000-0000-0000-0000000000aa"
        mode="create"
        defaultDate="2026-06-01"
      />,
    );

    // Act
    fireEvent.click(screen.getByRole("button", { name: "作成" }));

    // Assert
    await waitFor(() =>
      expect(screen.getByText("場所を入力してください")).toBeInTheDocument(),
    );
    expect(createMutate).not.toHaveBeenCalled();
  });
});
