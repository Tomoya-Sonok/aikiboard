import { describe, expect, it } from "vitest";
import {
  extractPlainText,
  parseBodyRich,
  renderEmailHtml,
} from "./richtext.js";

// ProseMirror / Tiptap JSON のホワイトリスト検証・抜粋・メール HTML 変換。

const doc = (content: unknown[]) => ({ type: "doc", content });
const para = (text: string, marks?: unknown[]) =>
  doc([{ type: "paragraph", content: [{ type: "text", text, marks }] }]);

describe("parseBodyRich", () => {
  it("見出し・太字・リンク・寄せを含む正規の doc を受理する", () => {
    // Arrange
    const input = doc([
      {
        type: "heading",
        attrs: { level: 2 },
        content: [{ type: "text", text: "審査案内" }],
      },
      {
        type: "paragraph",
        attrs: { textAlign: "center" },
        content: [
          { type: "text", text: "太字", marks: [{ type: "bold" }] },
          {
            type: "text",
            text: "リンク",
            marks: [{ type: "link", attrs: { href: "https://example.com" } }],
          },
        ],
      },
    ]);

    // Act
    const result = parseBodyRich(input);

    // Assert
    expect(result.ok).toBe(true);
  });

  it("未知のノード型(image)を拒否する", () => {
    // Arrange
    const input = doc([{ type: "image", attrs: { src: "x.png" } }]);

    // Act / Assert
    expect(parseBodyRich(input).ok).toBe(false);
  });

  it("javascript: スキームのリンクを拒否する", () => {
    // Arrange
    const input = para("クリック", [
      { type: "link", attrs: { href: "javascript:alert(1)" } },
    ]);

    // Act / Assert
    expect(parseBodyRich(input).ok).toBe(false);
  });

  it("heading の level 4 を拒否する(1-3 のみ)", () => {
    // Arrange
    const input = doc([
      {
        type: "heading",
        attrs: { level: 4 },
        content: [{ type: "text", text: "x" }],
      },
    ]);

    // Act / Assert
    expect(parseBodyRich(input).ok).toBe(false);
  });

  it("巨大なペイロードを拒否する", () => {
    // Arrange
    const input = para("あ".repeat(60_000));

    // Act / Assert
    expect(parseBodyRich(input).ok).toBe(false);
  });
});

describe("extractPlainText", () => {
  it("ブロックを改行で連結してテキスト抽出する", () => {
    // Arrange
    const input = doc([
      {
        type: "heading",
        attrs: { level: 2 },
        content: [{ type: "text", text: "見出し" }],
      },
      { type: "paragraph", content: [{ type: "text", text: "本文です" }] },
    ]);

    // Act / Assert
    expect(extractPlainText(input)).toBe("見出し\n本文です");
  });

  it("不正な入力には空文字を返す", () => {
    expect(extractPlainText({ foo: "bar" })).toBe("");
  });
});

describe("renderEmailHtml", () => {
  it("見出し・太字・リンクを HTML に変換する", () => {
    // Arrange
    const input = doc([
      {
        type: "heading",
        attrs: { level: 2 },
        content: [{ type: "text", text: "案内" }],
      },
      {
        type: "paragraph",
        content: [
          { type: "text", text: "強調", marks: [{ type: "bold" }] },
          {
            type: "text",
            text: "詳細",
            marks: [{ type: "link", attrs: { href: "https://example.com" } }],
          },
        ],
      },
    ]);

    // Act
    const html = renderEmailHtml(input);

    // Assert
    expect(html).toContain("<h2>案内</h2>");
    expect(html).toContain("<strong>強調</strong>");
    expect(html).toContain('<a href="https://example.com"');
    expect(html).toContain('rel="noopener noreferrer nofollow"');
  });

  it("HTML 特殊文字をエスケープする(XSS 対策)", () => {
    // Arrange
    const input = para("<script>alert(1)</script>");

    // Act
    const html = renderEmailHtml(input);

    // Assert
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
  });

  it("中央寄せを style に反映する", () => {
    // Arrange
    const input = doc([
      {
        type: "paragraph",
        attrs: { textAlign: "center" },
        content: [{ type: "text", text: "中央" }],
      },
    ]);

    // Act / Assert
    expect(renderEmailHtml(input)).toContain('style="text-align:center"');
  });
});
