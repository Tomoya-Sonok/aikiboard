"use client";

import { ChatCircle, DotsThree, Quotes, Trash } from "@phosphor-icons/react";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { Avatar } from "@/components/shared/Avatar/Avatar";
import {
  type CalendarLocale,
  formatJstDateLong,
  formatJstTime,
} from "@/lib/calendar/format";
import type { FeedPost } from "@/lib/types/post";
import styles from "./PostCard.module.css";

type Props = {
  post: FeedPost;
  // 削除実行(mutation + 一覧の再取得)は親が担う。
  onDelete: (id: string) => Promise<void>;
  // 返信(スレッド)を開く。
  onOpenThread: (post: FeedPost) => void;
};

export function PostCard({ post, onDelete, onOpenThread }: Props) {
  const t = useTranslations("boards.feed");
  const rawLocale = useLocale();
  const locale: CalendarLocale = rawLocale === "en" ? "en" : "ja";

  const [menuOpen, setMenuOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    setMenuOpen(false);
    if (!window.confirm(t("deleteConfirm"))) {
      return;
    }
    setDeleting(true);
    try {
      await onDelete(post.id);
    } finally {
      setDeleting(false);
    }
  };

  const imageCount = post.attachments.length;
  const gridClass =
    imageCount === 1
      ? styles.mediaGrid1
      : imageCount === 2
        ? styles.mediaGrid2
        : styles.mediaGridMany;

  return (
    <article className={styles.card}>
      <div className={styles.head}>
        <Avatar
          name={post.author.username}
          imageUrl={post.author.profileImageUrl}
          size={40}
        />
        <div className={styles.meta}>
          <span className={styles.author}>{post.author.username || "—"}</span>
          <span className={styles.time}>
            {formatJstDateLong(post.createdAt, locale)}{" "}
            {formatJstTime(post.createdAt, locale)}
          </span>
        </div>
        {post.canDelete ? (
          <div className={styles.menuWrap}>
            <button
              type="button"
              className={styles.menuBtn}
              onClick={() => setMenuOpen((o) => !o)}
              disabled={deleting}
              aria-label={t("menu")}
            >
              <DotsThree size={18} weight="bold" />
            </button>
            {menuOpen ? (
              <div className={styles.menu}>
                <button
                  type="button"
                  className={styles.menuItem}
                  onClick={handleDelete}
                >
                  <Trash size={14} />
                  <span>{t("delete")}</span>
                </button>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>

      {post.body ? <p className={styles.body}>{post.body}</p> : null}

      {post.quotedAikinotePost ? (
        <div className={styles.quote}>
          <span className={styles.quoteBadge}>
            <Quotes size={12} weight="fill" />
            {t("quoteFromAikinote")}
          </span>
          {post.quotedAikinotePost.isDeleted ? (
            <p className={styles.quoteDeleted}>{t("quoteDeleted")}</p>
          ) : (
            <>
              <p className={styles.quoteAuthor}>
                {post.quotedAikinotePost.authorName || "—"}
              </p>
              <p className={styles.quoteBody}>
                {post.quotedAikinotePost.content}
              </p>
            </>
          )}
        </div>
      ) : null}

      {post.crossPostToAikinote ? (
        <span className={styles.crossBadge}>{t("crossPosted")}</span>
      ) : null}

      {imageCount > 0 ? (
        <div className={`${styles.media} ${gridClass}`}>
          {post.attachments.map((a) =>
            a.url == null ? (
              <div key={a.id} className={styles.mediaMissing}>
                {t("mediaUnavailable")}
              </div>
            ) : a.type === "video" ? (
              // biome-ignore lint/a11y/useMediaCaption: ユーザー投稿動画。キャプショントラックは用意できない
              <video
                key={a.id}
                src={a.url}
                className={styles.mediaItem}
                controls
                preload="metadata"
              />
            ) : (
              // biome-ignore lint/performance/noImgElement: Supabase Storage 署名 URL。next/image の remotePatterns 設定を避ける
              <img
                key={a.id}
                src={a.url}
                alt=""
                className={styles.mediaItem}
                loading="lazy"
              />
            ),
          )}
        </div>
      ) : null}

      <div className={styles.footer}>
        <button
          type="button"
          className={styles.replies}
          onClick={() => onOpenThread(post)}
        >
          <ChatCircle size={16} />
          {post.replyCount > 0
            ? t("replyCount", { count: post.replyCount })
            : t("reply")}
        </button>
      </div>
    </article>
  );
}
