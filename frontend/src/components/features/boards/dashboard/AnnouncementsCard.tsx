"use client";

import { CaretRight, Megaphone } from "@phosphor-icons/react";
import { useQuery } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { type CalendarLocale, formatJstShortDate } from "@/lib/calendar/format";
import { Link } from "@/lib/i18n/routing";
import { trpcClient } from "@/lib/trpc/client";
import styles from "./DashboardCards.module.css";

type Props = {
  boardId: string;
  slug: string;
};

// ダッシュボードの「最新のお知らせ」カード(実データ)。最新 3 件 + 未読バッジ。
// 行クリック・「すべて見る」はお知らせ画面へ遷移する。
export function AnnouncementsCard({ boardId, slug }: Props) {
  const t = useTranslations("boards.dashboard");
  const rawLocale = useLocale();
  const locale: CalendarLocale = rawLocale === "en" ? "en" : "ja";

  const { data: listRes, isLoading } = useQuery({
    queryKey: ["announcements", boardId, "list", 3],
    queryFn: () =>
      trpcClient.announcements.list.query({ boardId, limit: 3, offset: 0 }),
  });
  const { data: unreadRes } = useQuery({
    queryKey: ["announcements", boardId, "unreadCount"],
    queryFn: () => trpcClient.announcements.unreadCount.query({ boardId }),
  });

  const items = listRes?.data?.items ?? [];
  const unread = unreadRes?.data?.count ?? 0;
  const announceHref = `/d/${slug}/announce`;

  return (
    <section className={styles.card}>
      <div className={styles.cardHeader}>
        <span className={styles.sectionLabel}>
          {t("announcements")}
          {unread > 0 ? (
            <span className={styles.countPill}>{unread}</span>
          ) : null}
        </span>
        <Link href={announceHref} className={styles.ghostLink}>
          {t("viewAll")}
          <CaretRight size={13} />
        </Link>
      </div>

      {isLoading ? (
        <div className={styles.emptyState}>…</div>
      ) : items.length === 0 ? (
        <div className={styles.emptyState}>
          <Megaphone size={20} />
          <span>{t("noAnnouncements")}</span>
        </div>
      ) : (
        <div>
          {items.map((a, i) => (
            <Link
              key={a.id}
              href={announceHref}
              className={`${styles.announceRow} ${i === 0 ? "" : styles.borderTop}`}
            >
              <span
                className={`${styles.unreadDot} ${
                  a.isDraft || a.isRead ? styles.readDot : ""
                }`}
              />
              <div className={styles.announceMain}>
                <div
                  className={`${styles.announceTitle} ${
                    !a.isDraft && !a.isRead ? "" : styles.announceTitleRead
                  }`}
                >
                  {a.title}
                </div>
                {a.excerpt ? (
                  <div className={styles.announceExcerpt}>{a.excerpt}</div>
                ) : null}
              </div>
              <div className={styles.announceDate}>
                {a.isDraft
                  ? formatJstShortDate(a.createdAt, locale)
                  : a.publishedAt
                    ? formatJstShortDate(a.publishedAt, locale)
                    : ""}
              </div>
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}
