"use client";

import { CalendarBlank, MapPin, UserCircle } from "@phosphor-icons/react";
import { useQuery } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import {
  type CalendarLocale,
  formatJstDateLong,
  formatJstTimeRange,
} from "@/lib/calendar/format";
import { trpcClient } from "@/lib/trpc/client";
import styles from "./PublicCalendar.module.css";

type Props = {
  slug: string;
};

const HORIZON_DAYS = 60;

// 公開ページに埋め込む読み取り専用の稽古一覧(これから 60 日)。
// 公開設定(is_public)のボード/稽古のみ anon API から取得する。
export function PublicCalendar({ slug }: Props) {
  const t = useTranslations("public");
  const rawLocale = useLocale();
  const locale: CalendarLocale = rawLocale === "en" ? "en" : "ja";

  const { from, to } = (() => {
    const now = Date.now();
    return {
      from: new Date(now).toISOString(),
      to: new Date(now + HORIZON_DAYS * 24 * 60 * 60 * 1000).toISOString(),
    };
  })();

  const { data, isLoading } = useQuery({
    queryKey: ["publicEvents", slug, from, to],
    queryFn: () => trpcClient.publicBoards.events.query({ slug, from, to }),
  });

  const events = data?.data ?? [];

  if (isLoading) {
    return <p className={styles.empty}>{t("loading")}</p>;
  }
  if (events.length === 0) {
    return <p className={styles.empty}>{t("noEvents")}</p>;
  }

  return (
    <ul className={styles.list}>
      {events.map((e) => (
        <li key={`${e.eventId}-${e.occurrenceStart}`} className={styles.item}>
          <span className={styles.date}>
            <CalendarBlank size={14} />
            {formatJstDateLong(e.startAt, locale)}
          </span>
          <span className={styles.time}>
            {formatJstTimeRange(e.startAt, e.endAt, locale)}
          </span>
          <span className={styles.place}>
            <MapPin size={14} />
            {e.place}
          </span>
          {e.instructorName ? (
            <span className={styles.instructor}>
              <UserCircle size={14} />
              {e.instructorName}
            </span>
          ) : null}
        </li>
      ))}
    </ul>
  );
}
