"use client";

import {
  CalendarBlank,
  CalendarX,
  Megaphone,
  PencilSimple,
  Pulse,
  Rss,
  SignIn,
  SignOut,
  UserMinus,
  UsersThree,
} from "@phosphor-icons/react";
import { useQuery } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import {
  type CalendarLocale,
  formatJstDateLong,
  formatJstTime,
} from "@/lib/calendar/format";
import { trpcClient } from "@/lib/trpc/client";
import type { ActivityItem } from "@/lib/types/activity";
import styles from "./ActivityView.module.css";

type Props = {
  boardId: string;
};

const PAGE_SIZE = 30;

// アクション → 表示アイコン。
const ICONS: Record<string, typeof Pulse> = {
  "event.created": CalendarBlank,
  "event.updated": PencilSimple,
  "event.deleted": CalendarX,
  "announcement.published": Megaphone,
  "post.created": Rss,
  "rsvp.responded": UsersThree,
  "member.joined": SignIn,
  "member.left": SignOut,
  "member.removed": UserMinus,
};

export function ActivityView({ boardId }: Props) {
  const t = useTranslations("boards.activity");
  const rawLocale = useLocale();
  const locale: CalendarLocale = rawLocale === "en" ? "en" : "ja";
  const [limit, setLimit] = useState(PAGE_SIZE);

  const { data, isLoading } = useQuery({
    queryKey: ["activityLogs", boardId, limit],
    queryFn: () =>
      trpcClient.activityLogs.list.query({ boardId, limit, offset: 0 }),
  });

  const items = data?.data?.items ?? [];
  const total = data?.data?.total ?? 0;
  const hasMore = items.length < total;

  // 動的キー(action 由来)+ パラメータで翻訳を引くため、t を緩い型で扱う。
  const tDyn = t as unknown as (
    key: string,
    values?: Record<string, string>,
  ) => string;

  const messageFor = (item: ActivityItem): string => {
    const name = item.actorName || t("someone");
    // i18n キーは action を "." → "_" にしたもの。
    const key = item.action.replace(/\./g, "_");
    return tDyn(key, { name });
  };

  return (
    <div className={styles.wrapper}>
      <div className={styles.header}>
        <h1 className={styles.heading}>{t("title")}</h1>
        <p className={styles.subtitle}>{t("subtitle")}</p>
      </div>

      {isLoading && items.length === 0 ? (
        <p className={styles.empty}>{t("loading")}</p>
      ) : items.length === 0 ? (
        <div className={styles.emptyState}>
          <Pulse size={28} className={styles.emptyIcon} />
          <p className={styles.empty}>{t("empty")}</p>
        </div>
      ) : (
        <ul className={styles.list}>
          {items.map((item) => {
            const Icon = ICONS[item.action] ?? Pulse;
            return (
              <li key={item.id} className={styles.row}>
                <span className={styles.iconWrap}>
                  <Icon size={16} />
                </span>
                <span className={styles.main}>
                  <span className={styles.message}>{messageFor(item)}</span>
                  {item.title ? (
                    <span className={styles.detail}>{item.title}</span>
                  ) : null}
                </span>
                <span className={styles.time}>
                  {formatJstDateLong(item.createdAt, locale)}{" "}
                  {formatJstTime(item.createdAt, locale)}
                </span>
              </li>
            );
          })}
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
    </div>
  );
}
