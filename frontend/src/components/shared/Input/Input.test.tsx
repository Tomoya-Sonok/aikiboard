import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Input } from "./Input";

describe("Input", () => {
  it("label と error を表示する", () => {
    // Arrange & Act
    render(<Input label="ボード名" name="name" error="必須です" />);

    // Assert
    expect(screen.getByLabelText("ボード名")).toBeInTheDocument();
    expect(screen.getByText("必須です")).toBeInTheDocument();
  });

  it("error が無ければ hint を表示する", () => {
    // Arrange & Act
    render(<Input label="URL" name="slug" hint="ヒント文" />);

    // Assert
    expect(screen.getByText("ヒント文")).toBeInTheDocument();
  });
});
