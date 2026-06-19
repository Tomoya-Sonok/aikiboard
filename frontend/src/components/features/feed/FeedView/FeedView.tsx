"use client";

import { Rss } from "@phosphor-icons/react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { trpcClient } from "@/lib/trpc/client";
import type { FeedPost } from "@/lib/types/post";
import { PostCard } from "../PostCard/PostCard";
import { PostComposer } from "../PostComposer/PostComposer";
import { PostThreadModal } from "../PostThreadModal/PostThreadModal";
import styles from "./FeedView.module.css";

type Props = {
  boardId: string;
};

const PAGE_SIZE = 20;

export function FeedView({ boardId }: Props) {
  const t = useTranslations("boards.feed");
  const queryClient = useQueryClient();
  const [limit, setLimit] = useState(PAGE_SIZE);
  const [threadPost, setThreadPost] = useState<FeedPost | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["boardPosts", boardId, "list", limit],
    queryFn: () =>
      trpcClient.boardPosts.list.query({ boardId, limit, offset: 0 }),
  });

  const items = data?.data?.items ?? [];
  const total = data?.data?.total ?? 0;
  const hasMore = items.length < total;

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["boardPosts", boardId] });
  };

  const handleDelete = async (id: string) => {
    const res = await trpcClient.boardPosts.remove.mutate({ id });
    if (!res.success) {
      throw new Error(res.error ?? t("deleteError"));
    }
    refresh();
  };

  return (
    <div className={styles.wrapper}>
      <h1 className={styles.heading}>{t("title")}</h1>

      <PostComposer boardId={boardId} onPosted={refresh} />

      {isLoading && items.length === 0 ? (
        <p className={styles.empty}>{t("loading")}</p>
      ) : items.length === 0 ? (
        <div className={styles.emptyState}>
          <Rss size={28} className={styles.emptyIcon} />
          <p className={styles.empty}>{t("empty")}</p>
        </div>
      ) : (
        <div className={styles.list}>
          {items.map((post) => (
            <PostCard
              key={post.id}
              post={post}
              onDelete={handleDelete}
              onOpenThread={setThreadPost}
            />
          ))}
        </div>
      )}

      {hasMore ? (
        <button
          type="button"
          className={styles.loadMore}
          onClick={() => setLimit((n) => n + PAGE_SIZE)}
        >
          {t("loadMore")}
        </button>
      ) : null}

      {threadPost ? (
        <PostThreadModal
          post={threadPost}
          open={threadPost !== null}
          onClose={() => setThreadPost(null)}
          onChanged={refresh}
        />
      ) : null}
    </div>
  );
}
