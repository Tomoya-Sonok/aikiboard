import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import messages from "@/translations/ja.json";
import { SignUpForm } from "./SignUpForm";

function renderWithIntl(ui: ReactNode) {
  return render(
    <NextIntlClientProvider locale="ja" messages={messages}>
      {ui}
    </NextIntlClientProvider>,
  );
}

describe("SignUpForm", () => {
  it("2ステップを経て onSubmit にマージした値を渡す", async () => {
    // Arrange
    const onSubmit = vi.fn();
    renderWithIntl(<SignUpForm onSubmit={onSubmit} />);

    // Act: step1(email/password)
    fireEvent.change(screen.getByLabelText("メールアドレス"), {
      target: { value: "taro@example.com" },
    });
    fireEvent.change(screen.getByLabelText("パスワード"), {
      target: { value: "Passw0rd!" },
    });
    fireEvent.click(screen.getByRole("button", { name: "次へ" }));

    // Act: step2(username)
    await waitFor(() =>
      expect(screen.getByLabelText("ユーザー名")).toBeInTheDocument(),
    );
    fireEvent.change(screen.getByLabelText("ユーザー名"), {
      target: { value: "taro" },
    });
    fireEvent.click(screen.getByRole("button", { name: "登録する" }));

    // Assert
    await waitFor(() => expect(onSubmit).toHaveBeenCalled());
    expect(onSubmit.mock.calls[0][0]).toEqual({
      email: "taro@example.com",
      password: "Passw0rd!",
      username: "taro",
    });
  });

  it("弱いパスワードでは次へ進まずエラーを表示する", async () => {
    // Arrange
    const onSubmit = vi.fn();
    renderWithIntl(<SignUpForm onSubmit={onSubmit} />);

    // Act
    fireEvent.change(screen.getByLabelText("メールアドレス"), {
      target: { value: "taro@example.com" },
    });
    // 8文字あるが小文字のみ(複雑性不足)
    fireEvent.change(screen.getByLabelText("パスワード"), {
      target: { value: "weakweak" },
    });
    fireEvent.click(screen.getByRole("button", { name: "次へ" }));

    // Assert: username ステップに進まず、エラーが出る
    await waitFor(() =>
      expect(
        screen.getByText(
          "大文字・小文字・数字・記号のうち3種類以上を含めてください",
        ),
      ).toBeInTheDocument(),
    );
    expect(screen.queryByLabelText("ユーザー名")).not.toBeInTheDocument();
  });
});
