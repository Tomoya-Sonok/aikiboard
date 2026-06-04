import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Dialog } from "./Dialog";

describe("Dialog", () => {
  it("open のとき role=dialog とタイトル・本文を表示する", () => {
    // Arrange & Act
    render(
      <Dialog open title="稽古の詳細" onClose={() => {}}>
        本文テキスト
      </Dialog>,
    );

    // Assert
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText("稽古の詳細")).toBeInTheDocument();
    expect(screen.getByText("本文テキスト")).toBeInTheDocument();
  });

  it("open=false なら何も描画しない", () => {
    // Arrange & Act
    render(
      <Dialog open={false} title="x" onClose={() => {}}>
        本文
      </Dialog>,
    );

    // Assert
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("Esc キーで onClose を呼ぶ", () => {
    // Arrange
    const onClose = vi.fn();
    render(
      <Dialog open title="x" onClose={onClose}>
        本文
      </Dialog>,
    );

    // Act
    fireEvent.keyDown(document, { key: "Escape" });

    // Assert
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("閉じるボタンで onClose を呼ぶ", () => {
    // Arrange
    const onClose = vi.fn();
    render(
      <Dialog open title="x" onClose={onClose} closeLabel="閉じる">
        本文
      </Dialog>,
    );

    // Act
    fireEvent.click(screen.getByLabelText("閉じる"));

    // Assert
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
