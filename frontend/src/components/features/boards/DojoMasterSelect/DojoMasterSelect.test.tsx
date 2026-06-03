import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { ReactElement } from "react";
import { describe, expect, it, vi } from "vitest";
import messages from "@/translations/ja.json";
import { type DojoMaster, DojoMasterSelect } from "./DojoMasterSelect";

const SEED: DojoMaster[] = [
  {
    id: "1",
    dojo_name: "合気会本部道場",
    dojo_name_kana: "あいきかいほんぶどうじょう",
  },
];

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

describe("DojoMasterSelect", () => {
  it("入力で検索し、選択すると onChange を呼ぶ", async () => {
    // Arrange
    const onChange = vi.fn();
    const searchDojos = vi.fn(async () => SEED);
    renderWithProviders(
      <DojoMasterSelect
        label="紐付ける道場"
        value={null}
        onChange={onChange}
        searchDojos={searchDojos}
      />,
    );

    // Act
    fireEvent.change(screen.getByLabelText("紐付ける道場"), {
      target: { value: "合気" },
    });
    await waitFor(
      () => expect(screen.getByText("合気会本部道場")).toBeInTheDocument(),
      { timeout: 2000 },
    );
    fireEvent.click(screen.getByText("合気会本部道場"));

    // Assert
    expect(searchDojos).toHaveBeenCalled();
    expect(onChange).toHaveBeenCalledWith(SEED[0]);
  });

  it("選択済みなら名称と変更ボタンを表示する", () => {
    // Arrange & Act
    renderWithProviders(
      <DojoMasterSelect
        label="紐付ける道場"
        value={SEED[0]}
        onChange={vi.fn()}
        searchDojos={vi.fn()}
      />,
    );

    // Assert
    expect(screen.getByText("合気会本部道場")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "変更" })).toBeInTheDocument();
  });
});
