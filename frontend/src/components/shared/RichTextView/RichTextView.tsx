// ProseMirror / Tiptap の doc JSON を React 要素へ描画する読み取り専用ビュー。
//
// dangerouslySetInnerHTML を使わず JSON を歩いて要素を生成するため、構造的に XSS が起きない。
// 対応ノード/マークは backend(lib/richtext.ts)のホワイトリストと一致させる:
//   ノード: doc / paragraph(textAlign) / heading(level 1-3, textAlign) / text / hardBreak
//   マーク: bold / link(http(s) のみ)
// 未知のノード/マークは無視する(壊れず素通り)。

import { Fragment, type ReactNode } from "react";
import styles from "./RichTextView.module.css";

type TextAlign = "left" | "center" | "right";

type MarkJson =
  | { type: "bold" }
  | { type: "link"; attrs?: { href?: unknown } }
  | { type: string; attrs?: Record<string, unknown> };

type NodeJson = {
  type?: string;
  text?: string;
  marks?: MarkJson[];
  attrs?: { level?: unknown; textAlign?: unknown };
  content?: NodeJson[];
};

const isSafeHref = (href: unknown): href is string => {
  if (typeof href !== "string") {
    return false;
  }
  try {
    const url = new URL(href);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
};

const alignOf = (attrs?: NodeJson["attrs"]): TextAlign | undefined => {
  const a = attrs?.textAlign;
  return a === "center" || a === "right" || a === "left" ? a : undefined;
};

// text ノード 1 つに bold / link マークを適用した要素を返す。
const renderText = (node: NodeJson, key: number): ReactNode => {
  let element: ReactNode = node.text ?? "";
  let href: string | null = null;
  let bold = false;
  for (const mark of node.marks ?? []) {
    if (mark.type === "bold") {
      bold = true;
    } else if (mark.type === "link" && isSafeHref(mark.attrs?.href)) {
      href = mark.attrs?.href as string;
    }
  }
  if (bold) {
    element = <strong>{element}</strong>;
  }
  if (href) {
    element = (
      <a href={href} target="_blank" rel="noopener noreferrer nofollow">
        {element}
      </a>
    );
  }
  return <Fragment key={key}>{element}</Fragment>;
};

const renderInline = (children: NodeJson[] | undefined): ReactNode =>
  (children ?? []).map((child, i) => {
    if (child.type === "hardBreak") {
      // biome-ignore lint/suspicious/noArrayIndexKey: 不変な静的ノード列。並べ替え無し
      return <br key={i} />;
    }
    if (child.type === "text") {
      return renderText(child, i);
    }
    return null;
  });

const renderBlock = (node: NodeJson, key: number): ReactNode => {
  const align = alignOf(node.attrs);
  const style = align ? { textAlign: align } : undefined;
  if (node.type === "heading") {
    const level = node.attrs?.level;
    const inner = renderInline(node.content);
    if (level === 1) {
      return (
        <h1 key={key} style={style}>
          {inner}
        </h1>
      );
    }
    if (level === 3) {
      return (
        <h3 key={key} style={style}>
          {inner}
        </h3>
      );
    }
    return (
      <h2 key={key} style={style}>
        {inner}
      </h2>
    );
  }
  if (node.type === "paragraph") {
    return (
      <p key={key} style={style}>
        {renderInline(node.content)}
      </p>
    );
  }
  return null;
};

export function RichTextView({ doc }: { doc: unknown }) {
  const root = doc as NodeJson | null | undefined;
  if (!root || root.type !== "doc") {
    return null;
  }
  return (
    <div className={styles.view}>
      {(root.content ?? []).map((block, i) => renderBlock(block, i))}
    </div>
  );
}
