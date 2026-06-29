"use client";

import { ImageSquare, Quotes, VideoCamera, X } from "@phosphor-icons/react";
import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useRef, useState } from "react";
import { Avatar } from "@/components/shared/Avatar/Avatar";
import {
  ALLOWED_MIME,
  isAllowedFile,
  uploadAttachment,
} from "@/lib/feed/uploadAttachment";
import { useAuth } from "@/lib/hooks/useAuth";
import { trpcClient } from "@/lib/trpc/client";
import type { AikinotePostSummary } from "@/lib/types/post";
import styles from "./PostComposer.module.css";

type Props = {
  boardId: string;
  onPosted: () => void;
};

type Picked = {
  file: File;
  previewUrl: string;
  kind: "image" | "video";
};

const MAX_ATTACHMENTS = 4;
const BODY_MAX = 5000;
const QUOTE_EXCERPT = 80;

const ACCEPT = [...ALLOWED_MIME].join(",");

export function PostComposer({ boardId, onPosted }: Props) {
  const t = useTranslations("boards.feed");
  const { user } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [body, setBody] = useState("");
  const [picked, setPicked] = useState<Picked[]>([]);
  const [crossPost, setCrossPost] = useState(false);
  const [quoted, setQuoted] = useState<AikinotePostSummary | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { data: quoteData, isLoading: quoteLoading } = useQuery({
    queryKey: ["boardPosts", boardId, "aikinotePosts"],
    queryFn: () => trpcClient.boardPosts.aikinotePosts.query({ boardId }),
    enabled: pickerOpen,
  });
  const quoteOptions = quoteData?.data ?? [];

  const canSubmit =
    !submitting &&
    (body.trim().length > 0 || picked.length > 0 || quoted !== null);

  const handlePick = (e: React.ChangeEvent<HTMLInputElement>) => {
    setError(null);
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (files.length === 0) {
      return;
    }
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
    if (files.length > room) {
      setError(t("tooManyFiles", { max: MAX_ATTACHMENTS }));
    }
    setPicked((prev) => [...prev, ...next]);
  };

  const removePicked = (index: number) => {
    setPicked((prev) => {
      const target = prev[index];
      if (target) {
        URL.revokeObjectURL(target.previewUrl);
      }
      return prev.filter((_, i) => i !== index);
    });
  };

  const reset = () => {
    for (const p of picked) {
      URL.revokeObjectURL(p.previewUrl);
    }
    setPicked([]);
    setBody("");
    setCrossPost(false);
    setQuoted(null);
  };

  const handleSubmit = async () => {
    if (!canSubmit) {
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const attachments = [];
      for (const p of picked) {
        attachments.push(await uploadAttachment(boardId, p.file));
      }
      const res = await trpcClient.boardPosts.create.mutate({
        boardId,
        body: body.trim(),
        attachments: attachments.length > 0 ? attachments : undefined,
        crossPostToAikinote: crossPost || undefined,
        syncedFromPostId: quoted?.id,
      });
      if (!res.success) {
        throw new Error(res.error ?? t("postError"));
      }
      reset();
      onPosted();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("postError"));
    } finally {
      setSubmitting(false);
    }
  };

  const excerpt = (s: string) =>
    s.length > QUOTE_EXCERPT ? `${s.slice(0, QUOTE_EXCERPT)}…` : s;

  return (
    <div className={styles.composer}>
      <div className={styles.top}>
        <Avatar name={user?.username ?? user?.email ?? ""} size={36} />
        <textarea
          className={styles.textarea}
          value={body}
          maxLength={BODY_MAX}
          placeholder={t("placeholder")}
          onChange={(e) => setBody(e.target.value)}
          rows={3}
        />
      </div>

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

      {quoted ? (
        <div className={styles.quoteChip}>
          <Quotes size={14} className={styles.quoteIcon} />
          <span className={styles.quoteText}>{excerpt(quoted.content)}</span>
          <button
            type="button"
            className={styles.quoteRemove}
            onClick={() => setQuoted(null)}
            aria-label={t("removeQuote")}
          >
            <X size={12} weight="bold" />
          </button>
        </div>
      ) : null}

      {error ? <p className={styles.error}>{error}</p> : null}

      <div className={styles.options}>
        <label className={styles.crossPost}>
          <input
            type="checkbox"
            checked={crossPost}
            onChange={(e) => setCrossPost(e.target.checked)}
          />
          <span>{t("crossPost")}</span>
        </label>
      </div>

      <div className={styles.bottom}>
        <div className={styles.tools}>
          <button
            type="button"
            className={styles.toolBtn}
            onClick={() => fileInputRef.current?.click()}
            disabled={submitting || picked.length >= MAX_ATTACHMENTS}
            title={t("addImage")}
          >
            <ImageSquare size={18} />
          </button>
          <span className={styles.toolHintIcon} aria-hidden="true">
            <VideoCamera size={18} />
          </span>
          <div className={styles.quotePickerWrap}>
            <button
              type="button"
              className={styles.toolBtn}
              onClick={() => setPickerOpen((o) => !o)}
              disabled={submitting}
              title={t("quoteAikinote")}
            >
              <Quotes size={18} />
            </button>
            {pickerOpen ? (
              <div className={styles.picker}>
                <p className={styles.pickerTitle}>{t("quotePickerTitle")}</p>
                {quoteLoading ? (
                  <p className={styles.pickerEmpty}>{t("loading")}</p>
                ) : quoteOptions.length === 0 ? (
                  <p className={styles.pickerEmpty}>{t("noAikinotePosts")}</p>
                ) : (
                  <ul className={styles.pickerList}>
                    {quoteOptions.map((p) => (
                      <li key={p.id}>
                        <button
                          type="button"
                          className={styles.pickerItem}
                          onClick={() => {
                            setQuoted(p);
                            setPickerOpen(false);
                          }}
                        >
                          {excerpt(p.content)}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ) : null}
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept={ACCEPT}
            multiple
            className={styles.fileInput}
            onChange={handlePick}
          />
          <span className={styles.counter}>
            {body.length}/{BODY_MAX}
          </span>
        </div>
        <button
          type="button"
          className={styles.submit}
          onClick={handleSubmit}
          disabled={!canSubmit}
        >
          {submitting ? t("posting") : t("post")}
        </button>
      </div>
    </div>
  );
}
