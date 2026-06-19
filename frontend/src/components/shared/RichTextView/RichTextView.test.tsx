import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { RichTextView } from "./RichTextView";

const doc = (content: unknown[]) => ({ type: "doc", content });

describe("RichTextView", () => {
  it("見出し・太字・段落を描画する", () => {
    // Arrange
    const input = doc([
      {
        type: "heading",
        attrs: { level: 2 },
        content: [{ type: "text", text: "審査案内" }],
      },
      {
        type: "paragraph",
        content: [{ type: "text", text: "強調", marks: [{ type: "bold" }] }],
      },
    ]);

    // Act
    const { container } = render(<RichTextView doc={input} />);

    // Assert
    expect(container.querySelector("h2")?.textContent).toBe("審査案内");
    expect(container.querySelector("strong")?.textContent).toBe("強調");
  });

  it("http(s) のリンクは安全な属性付きで描画する", () => {
    // Arrange
    const input = doc([
      {
        type: "paragraph",
        content: [
          {
            type: "text",
            text: "詳細",
            marks: [{ type: "link", attrs: { href: "https://example.com" } }],
          },
        ],
      },
    ]);

    // Act
    const { container } = render(<RichTextView doc={input} />);

    // Assert
    const link = container.querySelector("a");
    expect(link?.getAttribute("href")).toBe("https://example.com");
    expect(link?.getAttribute("rel")).toBe("noopener noreferrer nofollow");
  });

  it("javascript: スキームのリンクは <a> にせず素のテキストにする", () => {
    // Arrange
    const input = doc([
      {
        type: "paragraph",
        content: [
          {
            type: "text",
            text: "クリック",
            marks: [{ type: "link", attrs: { href: "javascript:alert(1)" } }],
          },
        ],
      },
    ]);

    // Act
    const { container } = render(<RichTextView doc={input} />);

    // Assert
    expect(container.querySelector("a")).toBeNull();
    expect(container.textContent).toContain("クリック");
  });

  it("未知のノードは無視して壊れない", () => {
    // Arrange
    const input = doc([
      { type: "image", attrs: { src: "x.png" } },
      { type: "paragraph", content: [{ type: "text", text: "本文" }] },
    ]);

    // Act
    const { container } = render(<RichTextView doc={input} />);

    // Assert
    expect(container.querySelector("img")).toBeNull();
    expect(container.textContent).toContain("本文");
  });

  it("doc でない入力は何も描画しない", () => {
    // Arrange / Act
    const { container } = render(<RichTextView doc={{ foo: "bar" }} />);

    // Assert
    expect(container.firstChild).toBeNull();
  });
});
