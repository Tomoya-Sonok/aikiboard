import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { ReactElement } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import messages from "@/translations/ja.json";
import { OAuthButtons } from "./OAuthButtons";

const signInWithGoogle = vi.fn();
let isProcessing = false;

vi.mock("@/lib/hooks/useAuth", () => ({
  useAuth: () => ({ signInWithGoogle, isProcessing }),
}));

function renderWithIntl(ui: ReactElement) {
  return render(
    <NextIntlClientProvider locale="ja" messages={messages}>
      {ui}
    </NextIntlClientProvider>,
  );
}

describe("OAuthButtons", () => {
  beforeEach(() => {
    signInWithGoogle.mockReset();
    signInWithGoogle.mockResolvedValue(undefined);
    isProcessing = false;
  });

  it("Google ボタンと区切りが表示される", () => {
    renderWithIntl(<OAuthButtons />);

    expect(
      screen.getByRole("button", { name: "Google で続ける" }),
    ).toBeTruthy();
    expect(screen.getByText("または")).toBeTruthy();
  });

  it("クリックすると signInWithGoogle を呼ぶ", async () => {
    renderWithIntl(<OAuthButtons />);

    fireEvent.click(screen.getByRole("button", { name: "Google で続ける" }));

    await waitFor(() => expect(signInWithGoogle).toHaveBeenCalledTimes(1));
  });

  it("失敗するとエラーメッセージを表示する", async () => {
    signInWithGoogle.mockRejectedValue(new Error("boom"));
    renderWithIntl(<OAuthButtons />);

    fireEvent.click(screen.getByRole("button", { name: "Google で続ける" }));

    await waitFor(() => expect(screen.getByRole("alert")).toBeTruthy());
  });

  it("処理中はボタンが無効になる", () => {
    isProcessing = true;
    renderWithIntl(<OAuthButtons />);

    const button = screen.getByRole("button", { name: "Google で続ける" });
    expect(button.hasAttribute("disabled")).toBe(true);
  });
});
