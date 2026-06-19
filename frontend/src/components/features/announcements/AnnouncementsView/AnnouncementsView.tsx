"use client";

import { Megaphone } from "@phosphor-icons/react";
import { useQuery } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { type CalendarLocale, formatJstDateLong } from "@/lib/calendar/format";
import { trpcClient } from "@/lib/trpc/client";
import type { AnnouncementSummary } from "@/lib/types/announcement";
import { AnnouncementDetailModal } from "../AnnouncementDetailModal/AnnouncementDetailModal";
import styles from "./AnnouncementsView.module.css";

type Props = {
  boardId: string;
  canManage: boolean;
};

const PAGE_SIZE = 20;

export function AnnouncementsView({ boardId }: Props) {
  const t = useTranslations("boards.announcements");
  const rawLocale = useLocale();
  const locale: CalendarLocale = rawLocale === "en" ? "en" : "ja";

  const [limit, setLimit] = useState(PAGE_SIZE);
  const [selected, setSelected] = useState<AnnouncementSummary | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["announcements", boardId, "list", limit],
    queryFn: () =>
      trpcClient.announcements.list.query({ boardId, limit, offset: 0 }),
  });

  const items = data?.data?.items ?? [];
  const total = data?.data?.total ?? 0;
  const hasMore = items.length < total;

  return (
    <div className={styles.wrapper}>
      <div className={styles.header}>
        <h1 className={styles.heading}>{t("title")}</h1>
      </div>

      {isLoading && items.length === 0 ? (
        <p className={styles.empty}>{t("loading")}</p>
      ) : items.length === 0 ? (
        <div className={styles.emptyState}>
          <Megaphone size={28} className={styles.emptyIcon} />
          <p className={styles.empty}>{t("empty")}</p>
        </div>
      ) : (
        <ul className={styles.list}>
          {items.map((item) => (
            <li key={item.id}>
              <button
                type="button"
                className={styles.row}
                onClick={() => setSelected(item)}
              >
                <span
                  className={`${styles.dot} ${
                    item.isDraft
                      ? styles.dotDraft
                      : item.isRead
                        ? styles.dotRead
                        : styles.dotUnread
                  }`}
                  aria-hidden="true"
                />
                <span className={styles.main}>
                  <span className={styles.titleRow}>
                    <span
                      className={`${styles.title} ${
                        !item.isDraft && !item.isRead ? styles.titleUnread : ""
                      }`}
                    >
                      {item.title}
                    </span>
                    {item.isDraft ? (
                      <span className={styles.draftBadge}>{t("draft")}</span>
                    ) : null}
                  </span>
                  {item.excerpt ? (
                    <span className={styles.excerpt}>{item.excerpt}</span>
                  ) : null}
                </span>
                <span className={styles.date}>
                  {item.isDraft
                    ? formatJstDateLong(item.createdAt, locale)
                    : item.publishedAt
                      ? formatJstDateLong(item.publishedAt, locale)
                      : ""}
                </span>
              </button>
            </li>
          ))}
        </ul>
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

      {selected ? (
        <AnnouncementDetailModal
          boardId={boardId}
          summary={selected}
          open={selected !== null}
          onClose={() => setSelected(null)}
        />
      ) : null}
    </div>
  );
}
