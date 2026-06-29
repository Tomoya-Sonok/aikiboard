"use client";

import { ImageSquare, X } from "@phosphor-icons/react";
import { useTranslations } from "next-intl";
import { useRef, useState } from "react";
import { Dialog } from "@/components/shared/Dialog/Dialog";
import { RichTextEditor } from "@/components/shared/RichTextEditor/RichTextEditor";
import { uploadArchiveAttachment } from "@/lib/archive/uploadArchiveAttachment";
import { ALLOWED_MIME, isAllowedFile } from "@/lib/feed/uploadAttachment";
import { trpcClient } from "@/lib/trpc/client";
import styles from "./ArchiveForm.module.css";

export type ArchiveEditing = {
  id: string;
  title: string;
  bodyRich: unknown;
};

type Props = {
  boardId: string;
  // 編集時。未指定は新規作成。
  editing?: ArchiveEditing;
  // 新規作成時の親ページ(ルートは null)。
  parentId?: string | null;
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
};

type Picked = { file: File; previewUrl: string; kind: "image" | "video" };

const TITLE_MAX = 200;
const MAX_ATTACHMENTS = 12;
const ACCEPT = [...ALLOWED_MIME].join(",");

const emptyDoc = { type: "doc", content: [{ type: "paragraph" }] };

export function ArchiveForm({
  boardId,
  editing,
  parentId = null,
  open,
  onClose,
  onSaved,
}: Props) {
  const t = useTranslations("boards.archive");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [title, setTitle] = useState(editing?.title ?? "");
  const [body, setBody] = useState<unknown>(editing?.bodyRich ?? emptyDoc);
  const [picked, setPicked] = useState<Picked[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isEdit = Boolean(editing);

  const handlePick = (e: React.ChangeEvent<HTMLInputElement>) => {
    setError(null);
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";
    const room = MAX_ATTACHMENTS - picked.length;
    const next: Picked[] = [];
    for (const file of files.slice(0, room)) {
      if (!isAllowedFile(file)) {
        setError(t("fileRejected"));
        continue;
      }
      next.push({
        file,
        previewUrl: URL.createObjectURL(file),
        kind: file.type.startsWith("video/") ? "video" : "image",
      });
    }
    setPicked((prev) => [...prev, ...next]);
  };

  const removePicked = (index: number) => {
    setPicked((prev) => {
      const target = prev[index];
      if (target) URL.revokeObjectURL(target.previewUrl);
      return prev.filter((_, i) => i !== index);
    });
  };

  const handleSave = async () => {
    if (title.trim().length === 0 || saving) {
      if (title.trim().length === 0) setError(t("titleRequired"));
      return;
    }
    setSaving(true);
    setError(null);
    try {
      if (isEdit && editing) {
        const res = await trpcClient.archives.update.mutate({
          id: editing.id,
          title: title.trim(),
          bodyRich: body,
        });
        if (!res.success) throw new Error(res.error ?? t("saveError"));
      } else {
        const attachments = [];
        for (const p of picked) {
          attachments.push(await uploadArchiveAttachment(boardId, p.file));
        }
        const res = await trpcClient.archives.create.mutate({
          boardId,
          parentId,
          title: title.trim(),
          bodyRich: body,
          attachments: attachments.length > 0 ? attachments : undefined,
        });
        if (!res.success) throw new Error(res.error ?? t("saveError"));
      }
      for (const p of picked) URL.revokeObjectURL(p.previewUrl);
      setPicked([]);
      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("saveError"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={isEdit ? t("editTitle") : t("createTitle")}
      maxWidth={720}
    >
      <div className={styles.form}>
        <label className={styles.field}>
          <span className={styles.label}>{t("pageTitle")}</span>
          <input
            className={styles.input}
            value={title}
            maxLength={TITLE_MAX}
            placeholder={t("pageTitlePlaceholder")}
            onChange={(e) => setTitle(e.target.value)}
          />
        </label>

        <div className={styles.field}>
          <span className={styles.label}>{t("body")}</span>
          <RichTextEditor value={body} onChange={setBody} />
        </div>

        {!isEdit ? (
          <div className={styles.field}>
            <span className={styles.label}>{t("attachments")}</span>
            {picked.length > 0 ? (
              <div className={styles.previews}>
                {picked.map((p, i) => (
                  <div key={p.previewUrl} className={styles.preview}>
                    {p.kind === "image" ? (
                      // biome-ignore lint/performance/noImgElement: ローカル object URL のプレビュー
                      <img
                        src={p.previewUrl}
                        alt=""
                        className={styles.previewMedia}
                      />
                    ) : (
                      <video
                        src={p.previewUrl}
                        className={styles.previewMedia}
                        muted
                      />
                    )}
                    <button
                      type="button"
                      className={styles.removeBtn}
                      onClick={() => removePicked(i)}
                      aria-label={t("removeAttachment")}
                    >
                      <X size={12} weight="bold" />
                    </button>
                  </div>
                ))}
              </div>
            ) : null}
            <button
              type="button"
              className={styles.addMedia}
              onClick={() => fileInputRef.current?.click()}
              disabled={picked.length >= MAX_ATTACHMENTS}
            >
              <ImageSquare size={16} />
              {t("addMedia")}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept={ACCEPT}
              multiple
              className={styles.fileInput}
              onChange={handlePick}
            />
          </div>
        ) : null}

        {error ? <p className={styles.error}>{error}</p> : null}

        <div className={styles.actions}>
          <button
            type="button"
            className={styles.cancel}
            onClick={onClose}
            disabled={saving}
          >
            {t("cancel")}
          </button>
          <button
            type="button"
            className={styles.save}
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? t("saving") : t("save")}
          </button>
        </div>
      </div>
    </Dialog>
  );
}
