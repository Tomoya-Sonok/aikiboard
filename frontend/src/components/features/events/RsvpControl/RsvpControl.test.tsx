import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { ReactElement } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import messages from "@/translations/ja.json";
import { RsvpControl } from "./RsvpControl";

const setMutate = vi.fn(async () => ({ success: true }));
const clearMutate = vi.fn(async () => ({ success: true }));

vi.mock("@/lib/trpc/client", () => ({
  trpcClient: {
    events: {
      setRsvp: { mutate: (...args: unknown[]) => setMutate(...args) },
      clearRsvp: { mutate: (...args: unknown[]) => clearMutate(...args) },
    },
  },
}));

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

const EVENT_ID = "00000000-0000-0000-0000-0000000000aa";
const OCC = "2026-06-10T10:00:00.000Z";

describe("RsvpControl", () => {
  beforeEach(() => {
    setMutate.mockClear();
    clearMutate.mockClear();
  });

  it("参加をクリックすると attend で表明する", async () => {
    // Arrange
    renderWithProviders(
      <RsvpControl
        eventId={EVENT_ID}
        occurrenceStart={OCC}
        myStatus={null}
        onChanged={() => {}}
      />,
    );

    // Act
    fireEvent.click(screen.getByRole("button", { name: "参加" }));

    // Assert
    await waitFor(() =>
      expect(setMutate).toHaveBeenCalledWith(
        expect.objectContaining({ status: "attend", occurrenceStart: OCC }),
      ),
    );
  });

  it("選択済みの参加を再クリックすると未回答に戻す", async () => {
    // Arrange
    renderWithProviders(
      <RsvpControl
        eventId={EVENT_ID}
        occurrenceStart={OCC}
        myStatus="attend"
        onChanged={() => {}}
      />,
    );

    // Act
    fireEvent.click(screen.getByRole("button", { name: "参加" }));

    // Assert
    await waitFor(() => expect(clearMutate).toHaveBeenCalledTimes(1));
    expect(setMutate).not.toHaveBeenCalled();
  });
});
