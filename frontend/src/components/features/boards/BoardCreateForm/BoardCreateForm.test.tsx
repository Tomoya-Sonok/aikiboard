import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { ReactElement } from "react";
import { describe, expect, it, vi } from "vitest";
import type { DojoMaster } from "@/components/features/boards/DojoMasterSelect/DojoMasterSelect";
import messages from "@/translations/ja.json";
import { BoardCreateForm } from "./BoardCreateForm";

const SEED: DojoMaster[] = [
  {
    id: "1",
    dojo_name: "合気会本部道場",
    dojo_name_kana: "あいきかいほんぶどうじょう",
  },
];

const searchDojos = async () => SEED;

function renderWithProviders(ui: ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <NextIntlClientProvider locale="ja" messages={messages}>
        {ui}
      </NextIntlClientProvider>
    </QueryClientProvider>,
  );
}

async function fillBaseFields() {
  // 必須ラベルは末尾に aria-hidden のアスタリスクが付くため部分一致で取得する。
  fireEvent.change(screen.getByLabelText(/ボード名/), {
    target: { value: "一般稽古" },
  });
  fireEvent.change(screen.getByLabelText(/ボードURL/), {
    target: { value: "warabi-general" },
  });
}

describe("BoardCreateForm", () => {
  it("道場が未選択だと submit せずエラーを表示する", async () => {
    // Arrange
    const onSubmit = vi.fn();
    renderWithProviders(
      <BoardCreateForm onSubmit={onSubmit} searchDojos={searchDojos} />,
    );

    // Act
    await fillBaseFields();
    fireEvent.click(screen.getByRole("button", { name: "作成する" }));

    // Assert
    await waitFor(() =>
      expect(
        screen.getByText("ボードに紐づける道場を入力・選択してください"),
      ).toBeInTheDocument(),
    );
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("道場を選択して submit すると dojoMasterIds 付きで呼ぶ", async () => {
    // Arrange
    const onSubmit = vi.fn();
    renderWithProviders(
      <BoardCreateForm onSubmit={onSubmit} searchDojos={searchDojos} />,
    );

    // Act
    await fillBaseFields();
    fireEvent.change(screen.getByLabelText(/道場名/), {
      target: { value: "合気" },
    });
    await waitFor(
      () => expect(screen.getByText("合気会本部道場")).toBeInTheDocument(),
      { timeout: 2000 },
    );
    fireEvent.click(screen.getByText("合気会本部道場"));
    fireEvent.click(screen.getByRole("button", { name: "作成する" }));

    // Assert
    await waitFor(() => expect(onSubmit).toHaveBeenCalled());
    expect(onSubmit.mock.calls[0][0]).toMatchObject({
      name: "一般稽古",
      slug: "warabi-general",
      isPublic: true,
      dojoMasterIds: ["1"],
    });
  });
});
