import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import messages from "@/translations/ja.json";
import { LoginForm } from "./LoginForm";

function renderWithIntl(ui: ReactNode) {
  return render(
    <NextIntlClientProvider locale="ja" messages={messages}>
      {ui}
    </NextIntlClientProvider>,
  );
}

describe("LoginForm", () => {
  it("正しい入力で onSubmit が値とともに呼ばれる", async () => {
    // Arrange
    const onSubmit = vi.fn();
    renderWithIntl(<LoginForm onSubmit={onSubmit} />);

    // Act
    fireEvent.change(screen.getByLabelText("メールアドレス"), {
      target: { value: "taro@example.com" },
    });
    fireEvent.change(screen.getByLabelText("パスワード"), {
      target: { value: "secret" },
    });
    fireEvent.click(screen.getByRole("button", { name: "ログイン" }));

    // Assert
    await waitFor(() => expect(onSubmit).toHaveBeenCalled());
    expect(onSubmit.mock.calls[0][0]).toEqual({
      email: "taro@example.com",
      password: "secret",
    });
  });

  it("不正な email はインラインエラーを表示し onSubmit を呼ばない", async () => {
    // Arrange
    const onSubmit = vi.fn();
    renderWithIntl(<LoginForm onSubmit={onSubmit} />);

    // Act
    fireEvent.change(screen.getByLabelText("メールアドレス"), {
      target: { value: "invalid" },
    });
    fireEvent.change(screen.getByLabelText("パスワード"), {
      target: { value: "secret" },
    });
    fireEvent.click(screen.getByRole("button", { name: "ログイン" }));

    // Assert
    await waitFor(() =>
      expect(
        screen.getByText("メールアドレスの形式が正しくありません"),
      ).toBeInTheDocument(),
    );
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("serverError を表示する", () => {
    // Arrange & Act
    renderWithIntl(
      <LoginForm onSubmit={vi.fn()} serverError="認証に失敗しました" />,
    );

    // Assert
    expect(screen.getByRole("alert")).toHaveTextContent("認証に失敗しました");
  });
});
