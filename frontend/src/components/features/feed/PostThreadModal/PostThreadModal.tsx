"use client";

import { PaperPlaneRight, Trash } from "@phosphor-icons/react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { Avatar } from "@/components/shared/Avatar/Avatar";
import { Dialog } from "@/components/shared/Dialog/Dialog";
import {
  type CalendarLocale,
  formatJstDateLong,
  formatJstTime,
} from "@/lib/calendar/format";
import { trpcClient } from "@/lib/trpc/client";
import type { FeedPost } from "@/lib/types/post";
import styles from "./PostThreadModal.module.css";

type Props = {
  post: FeedPost;
  open: boolean;
  onClose: () => void;
  // 返信数が変わったら親(フィード一覧)も再取得する。
  onChanged: () => void;
};

const REPLY_MAX = 5000;

export function PostThreadModal({ post, open, onClose, onChanged }: Props) {
  const t = useTranslations("boards.feed");
  const rawLocale = useLocale();
  const locale: CalendarLocale = rawLocale === "en" ? "en" : "ja";
  const queryClient = useQueryClient();

  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["boardPosts", "threads", post.id],
    queryFn: () => trpcClient.boardPosts.listThreads.query({ postId: post.id }),
    enabled: open,
  });
  const replies = data?.data ?? [];

  const refresh = () => {
    queryClient.invalidateQueries({
      queryKey: ["boardPosts", "threads", post.id],
    });
    onChanged();
  };

  const handleSend = async () => {
    if (body.trim().length === 0 || sending) {
      return;
    }
    setSending(true);
    setError(null);
    try {
      const res = await trpcClient.boardPosts.createThread.mutate({
        postId: post.id,
        body: body.trim(),
      });
      if (!res.success) {
        throw new Error(res.error ?? t("replyError"));
      }
      setBody("");
      refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("replyError"));
    } finally {
      setSending(false);
    }
  };

  const handleDelete = async (threadId: string) => {
    if (!window.confirm(t("replyDeleteConfirm"))) {
      return;
    }
    const res = await trpcClient.boardPosts.removeThread.mutate({
      postId: post.id,
      threadId,
    });
    if (res.success) {
      refresh();
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={t("threadTitle")}
      maxWidth={560}
    >
      <div className={styles.wrapper}>
        {/* 元投稿 */}
        <div className={styles.origin}>
          <Avatar
            name={post.author.username}
            imageUrl={post.author.profileImageUrl}
            size={36}
          />
          <div className={styles.originMain}>
            <span className={styles.author}>{post.author.username || "—"}</span>
            <span className={styles.time}>
              {formatJstDateLong(post.createdAt, locale)}{" "}
              {formatJstTime(post.createdAt, locale)}
            </span>
            {post.body ? <p className={styles.body}>{post.body}</p> : null}
          </div>
        </div>

        {/* 返信一覧 */}
        <div className={styles.replies}>
          {isLoading ? (
            <p className={styles.empty}>{t("loading")}</p>
          ) : replies.length === 0 ? (
            <p className={styles.empty}>{t("noReplies")}</p>
          ) : (
            replies.map((r) => (
              <div key={r.id} className={styles.reply}>
                <Avatar
                  name={r.author.username}
                  imageUrl={r.author.profileImageUrl}
                  size={32}
                />
                <div className={styles.replyMain}>
                  <div className={styles.replyHead}>
                    <span className={styles.replyAuthor}>
                      {r.author.username || "—"}
                    </span>
                    <span className={styles.replyTime}>
                      {formatJstDateLong(r.createdAt, locale)}{" "}
                      {formatJstTime(r.createdAt, locale)}
                    </span>
                    {r.canDelete ? (
                      <button
                        type="button"
                        className={styles.replyDelete}
                        onClick={() => handleDelete(r.id)}
                        aria-label={t("delete")}
                      >
                        <Trash size={13} />
                      </button>
                    ) : null}
                  </div>
                  <p className={styles.replyBody}>{r.body}</p>
                </div>
              </div>
            ))
          )}
        </div>

        {error ? <p className={styles.error}>{error}</p> : null}

        {/* 返信入力 */}
        <div className={styles.composer}>
          <textarea
            className={styles.input}
            value={body}
            maxLength={REPLY_MAX}
            placeholder={t("replyPlaceholder")}
            onChange={(e) => setBody(e.target.value)}
            rows={2}
          />
          <button
            type="button"
            className={styles.send}
            onClick={handleSend}
            disabled={sending || body.trim().length === 0}
            aria-label={t("reply")}
          >
            <PaperPlaneRight size={16} weight="fill" />
          </button>
        </div>
      </div>
    </Dialog>
  );
}
