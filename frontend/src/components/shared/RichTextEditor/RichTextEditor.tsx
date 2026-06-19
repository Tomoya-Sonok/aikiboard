"use client";

import {
  ArrowUUpLeft,
  ArrowUUpRight,
  LinkBreak,
  LinkSimple,
  TextAlignCenter,
  TextAlignLeft,
  TextAlignRight,
  TextB,
} from "@phosphor-icons/react";
import Bold from "@tiptap/extension-bold";
import Document from "@tiptap/extension-document";
import HardBreak from "@tiptap/extension-hard-break";
import Heading from "@tiptap/extension-heading";
import Link from "@tiptap/extension-link";
import Paragraph from "@tiptap/extension-paragraph";
import Text from "@tiptap/extension-text";
import TextAlign from "@tiptap/extension-text-align";
import { Placeholder, UndoRedo } from "@tiptap/extensions";
import { EditorContent, useEditor } from "@tiptap/react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { Button } from "@/components/shared/Button/Button";
import { Dialog } from "@/components/shared/Dialog/Dialog";
import { Input } from "@/components/shared/Input/Input";
import styles from "./RichTextEditor.module.css";

type Props = {
  // 初期内容(ProseMirror JSON)。マウント時にだけ取り込む(以降は非同期に上書きしない)。
  value?: unknown;
  onChange: (doc: unknown) => void;
  placeholder?: string;
};

// バックエンド(richtext.ts)と RichTextView のホワイトリストに一致する最小スキーマの
// Tiptap エディタ。WordPress 風のツールバー(段落/見出し・太字・リンク・寄せ)。
export function RichTextEditor({ value, onChange, placeholder }: Props) {
  const t = useTranslations("boards.announcements");
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkUrl, setLinkUrl] = useState("");

  const editor = useEditor({
    // Next.js の SSR ではサーバー描画を抑止する(ハイドレーション不整合を防ぐ)。
    immediatelyRender: false,
    extensions: [
      Document,
      Paragraph,
      Text,
      HardBreak,
      Bold,
      Heading.configure({ levels: [2, 3] }),
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      Link.configure({
        openOnClick: false,
        autolink: true,
        protocols: ["http", "https"],
        HTMLAttributes: {
          rel: "noopener noreferrer nofollow",
          target: "_blank",
        },
      }),
      UndoRedo,
      Placeholder.configure({ placeholder: placeholder ?? "" }),
    ],
    content: (value as object) ?? "",
    editorProps: {
      attributes: { class: styles.content },
    },
    onUpdate: ({ editor: e }) => onChange(e.getJSON()),
  });

  if (!editor) {
    return null;
  }

  const blockValue = editor.isActive("heading", { level: 2 })
    ? "h2"
    : editor.isActive("heading", { level: 3 })
      ? "h3"
      : "p";

  const onBlockChange = (next: string) => {
    const chain = editor.chain().focus();
    if (next === "h2") {
      chain.setHeading({ level: 2 }).run();
    } else if (next === "h3") {
      chain.setHeading({ level: 3 }).run();
    } else {
      chain.setParagraph().run();
    }
  };

  const openLinkDialog = () => {
    const current = editor.getAttributes("link").href as string | undefined;
    setLinkUrl(current ?? "");
    setLinkOpen(true);
  };

  const applyLink = () => {
    const url = linkUrl.trim();
    if (url === "") {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
    } else {
      editor
        .chain()
        .focus()
        .extendMarkRange("link")
        .setLink({ href: url })
        .run();
    }
    setLinkOpen(false);
  };

  const removeLink = () => {
    editor.chain().focus().extendMarkRange("link").unsetLink().run();
    setLinkOpen(false);
  };

  return (
    <div className={styles.editor}>
      <div className={styles.toolbar}>
        <select
          className={styles.blockSelect}
          value={blockValue}
          onChange={(e) => onBlockChange(e.target.value)}
          aria-label={t("editor.blockType")}
        >
          <option value="p">{t("editor.paragraph")}</option>
          <option value="h2">{t("editor.heading2")}</option>
          <option value="h3">{t("editor.heading3")}</option>
        </select>

        <span className={styles.divider} />

        <button
          type="button"
          className={`${styles.tool} ${editor.isActive("bold") ? styles.toolActive : ""}`}
          onClick={() => editor.chain().focus().toggleBold().run()}
          aria-label={t("editor.bold")}
          aria-pressed={editor.isActive("bold")}
        >
          <TextB size={16} weight="bold" />
        </button>
        <button
          type="button"
          className={`${styles.tool} ${editor.isActive("link") ? styles.toolActive : ""}`}
          onClick={openLinkDialog}
          aria-label={t("editor.link")}
          aria-pressed={editor.isActive("link")}
        >
          <LinkSimple size={16} />
        </button>

        <span className={styles.divider} />

        <button
          type="button"
          className={`${styles.tool} ${editor.isActive({ textAlign: "left" }) ? styles.toolActive : ""}`}
          onClick={() => editor.chain().focus().setTextAlign("left").run()}
          aria-label={t("editor.alignLeft")}
        >
          <TextAlignLeft size={16} />
        </button>
        <button
          type="button"
          className={`${styles.tool} ${editor.isActive({ textAlign: "center" }) ? styles.toolActive : ""}`}
          onClick={() => editor.chain().focus().setTextAlign("center").run()}
          aria-label={t("editor.alignCenter")}
        >
          <TextAlignCenter size={16} />
        </button>
        <button
          type="button"
          className={`${styles.tool} ${editor.isActive({ textAlign: "right" }) ? styles.toolActive : ""}`}
          onClick={() => editor.chain().focus().setTextAlign("right").run()}
          aria-label={t("editor.alignRight")}
        >
          <TextAlignRight size={16} />
        </button>

        <span className={styles.divider} />

        <button
          type="button"
          className={styles.tool}
          onClick={() => editor.chain().focus().undo().run()}
          disabled={!editor.can().undo()}
          aria-label={t("editor.undo")}
        >
          <ArrowUUpLeft size={16} />
        </button>
        <button
          type="button"
          className={styles.tool}
          onClick={() => editor.chain().focus().redo().run()}
          disabled={!editor.can().redo()}
          aria-label={t("editor.redo")}
        >
          <ArrowUUpRight size={16} />
        </button>
      </div>

      <EditorContent editor={editor} className={styles.contentWrap} />

      {linkOpen ? (
        <Dialog
          open={linkOpen}
          onClose={() => setLinkOpen(false)}
          title={t("editor.linkTitle")}
          footer={
            <>
              {editor.isActive("link") ? (
                <Button variant="secondary" onClick={removeLink}>
                  <span className={styles.removeLinkLabel}>
                    <LinkBreak size={14} />
                    {t("editor.removeLink")}
                  </span>
                </Button>
              ) : null}
              <Button onClick={applyLink}>{t("editor.applyLink")}</Button>
            </>
          }
        >
          <Input
            label={t("editor.linkUrl")}
            value={linkUrl}
            onChange={(e) => setLinkUrl(e.target.value)}
            placeholder="https://example.com"
            type="url"
          />
        </Dialog>
      ) : null}
    </div>
  );
}
