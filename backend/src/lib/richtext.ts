// お知らせ本文(body_rich)で扱う ProseMirror / Tiptap JSON の検証と変換。
//
// frontend の Tiptap エディタが出力する JSON を、許可ノード・マークだけに厳格に絞り込む
// ホワイトリスト方式で検証する。backend は service_role で動くため、ここが本文に対する
// 唯一の入力検証であり、XSS の最終防衛線でもある(閲覧側は自前 React レンダラ、メールは
// 自前シリアライザなので、未知ノードを弾けばそのまま安全になる)。
//
// 対応する構造(frontend の Tiptap 拡張と完全一致させること):
//   ノード: doc / paragraph(textAlign) / heading(level 1-3, textAlign) / text / hardBreak
//   マーク: bold / link(href は http(s) のみ)
//
// メール HTML へのシリアライズ(renderEmailHtml)と一覧の抜粋(extractPlainText)も
// ノード定義をここに集約する。

import { z } from "zod";

// 本文 JSON のシリアライズ後サイズ上限(おおよそ。巨大ペイロード対策)。
export const BODY_RICH_MAX_BYTES = 50 * 1024;

const textAlign = z.enum(["left", "center", "right"]).optional();

// link の href は http(s) のみ許可(javascript: 等のスキームを構造的に排除)。
const isSafeHref = (href: string): boolean => {
  try {
    const url = new URL(href);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
};

const boldMark = z.object({ type: z.literal("bold") });
const linkMark = z.object({
  type: z.literal("link"),
  attrs: z.object({
    href: z.string().refine(isSafeHref, "リンク先が不正です"),
    target: z.string().nullable().optional(),
    rel: z.string().nullable().optional(),
    class: z.string().nullable().optional(),
  }),
});
const markSchema = z.discriminatedUnion("type", [boldMark, linkMark]);

const textNode = z.object({
  type: z.literal("text"),
  text: z.string().min(1),
  marks: z.array(markSchema).optional(),
});

const hardBreakNode = z.object({ type: z.literal("hardBreak") });

// インライン(text / hardBreak)のみを子に取れるブロック。
const inlineChild = z.union([textNode, hardBreakNode]);

const paragraphNode = z.object({
  type: z.literal("paragraph"),
  attrs: z.object({ textAlign }).optional(),
  content: z.array(inlineChild).optional(),
});

const headingNode = z.object({
  type: z.literal("heading"),
  attrs: z.object({ level: z.number().int().min(1).max(3), textAlign }),
  content: z.array(inlineChild).optional(),
});

const blockChild = z.union([paragraphNode, headingNode]);

export const bodyRichSchema = z.object({
  type: z.literal("doc"),
  content: z.array(blockChild).max(500).optional(),
});

export type BodyRich = z.infer<typeof bodyRichSchema>;
export type RichBlock = z.infer<typeof blockChild>;
export type RichInline = z.infer<typeof inlineChild>;
export type RichMark = z.infer<typeof markSchema>;

// 入力 JSON を検証する。サイズ上限も併せて確認する。
export const parseBodyRich = (
  input: unknown,
): { ok: true; value: BodyRich } | { ok: false } => {
  if (JSON.stringify(input ?? null).length > BODY_RICH_MAX_BYTES) {
    return { ok: false };
  }
  const result = bodyRichSchema.safeParse(input);
  return result.success ? { ok: true, value: result.data } : { ok: false };
};

// 一覧カードの抜粋などに使うプレーンテキスト抽出。ブロック間は改行で連結する。
export const extractPlainText = (body: unknown): string => {
  const result = bodyRichSchema.safeParse(body);
  if (!result.success) {
    return "";
  }
  const lines: string[] = [];
  for (const block of result.data.content ?? []) {
    let line = "";
    for (const child of block.content ?? []) {
      if (child.type === "text") {
        line += child.text;
      }
    }
    lines.push(line);
  }
  return lines.join("\n").trim();
};

// ─────────────────────────────────────────────────────────────
// メール HTML シリアライズ
// ─────────────────────────────────────────────────────────────

export const escapeHtml = (s: string): string =>
  s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const alignStyle = (align?: "left" | "center" | "right"): string =>
  align && align !== "left" ? ` style="text-align:${align}"` : "";

const renderInline = (children: RichInline[] | undefined): string => {
  if (!children) {
    return "";
  }
  let html = "";
  for (const child of children) {
    if (child.type === "hardBreak") {
      html += "<br />";
      continue;
    }
    let text = escapeHtml(child.text);
    let href: string | null = null;
    let bold = false;
    for (const mark of child.marks ?? []) {
      if (mark.type === "bold") {
        bold = true;
      } else if (mark.type === "link" && isSafeHref(mark.attrs.href)) {
        href = mark.attrs.href;
      }
    }
    if (bold) {
      text = `<strong>${text}</strong>`;
    }
    if (href) {
      text = `<a href="${escapeHtml(href)}" target="_blank" rel="noopener noreferrer nofollow">${text}</a>`;
    }
    html += text;
  }
  return html;
};

// body_rich(検証済みでなくても安全に倒す)→ メール本文の HTML 断片。
export const renderEmailHtml = (body: unknown): string => {
  const result = bodyRichSchema.safeParse(body);
  if (!result.success) {
    return "";
  }
  const parts: string[] = [];
  for (const block of result.data.content ?? []) {
    const inner = renderInline(block.content);
    const align = block.attrs?.textAlign;
    if (block.type === "heading") {
      const tag = `h${block.attrs.level}`;
      parts.push(`<${tag}${alignStyle(align)}>${inner}</${tag}>`);
    } else {
      // 空段落は余白として <br /> 一つに倒す。
      parts.push(`<p${alignStyle(align)}>${inner || "<br />"}</p>`);
    }
  }
  return parts.join("\n");
};
