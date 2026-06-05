"use client";

import { CalendarBlank, CaretRight, MapPin, User } from "@phosphor-icons/react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { RsvpControl } from "@/components/features/events/RsvpControl/RsvpControl";
import {
  type CalendarLocale,
  formatJstDateParts,
  formatJstTimeRange,
} from "@/lib/calendar/format";
import { Link } from "@/lib/i18n/routing";
import { trpcClient } from "@/lib/trpc/client";
import styles from "./DashboardCards.module.css";

type Props = {
  boardId: string;
  slug: string;
};

// JST カレンダー日での差(経過時間ではなく日界で数える。Asia/Tokyo は固定 +9h)。
const JST_OFFSET_MS = 9 * 60 * 60 * 1000;
const jstDayIndex = (ms: number): number =>
  Math.floor((ms + JST_OFFSET_MS) / 86_400_000);
const daysUntil = (iso: string): number =>
  Math.max(0, jstDayIndex(Date.parse(iso)) - jstDayIndex(Date.now()));

// ダッシュボードの「次の稽古」カード(実データ)。出欠表明はカレンダーと同じ RsvpControl を使う。
export function NextPracticeCard({ boardId, slug }: Props) {
  const t = useTranslations("boards.dashboard");
  const rawLocale = useLocale();
  const locale: CalendarLocale = rawLocale === "en" ? "en" : "ja";
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["events", "next", boardId],
    queryFn: () => trpcClient.events.next.query({ boardId }),
  });
  const occ = data?.data ?? null;

  // 出欠が変わったら next / 一覧 / 名簿(すべて "events" 前置のキー)を最新化する。
  const refresh = () => queryClient.invalidateQueries({ queryKey: ["events"] });

  const header = (
    <div className={styles.cardHeader}>
      <span className={styles.sectionLabel}>
        {t("nextPractice")}
        {occ ? (
          <span className={styles.muted}>
            {t("daysUntil", { days: daysUntil(occ.startAt) })}
          </span>
        ) : null}
      </span>
      <Link href={`/d/${slug}/calendar`} className={styles.ghostLink}>
        {t("viewDetail")}
        <CaretRight size={13} />
      </Link>
    </div>
  );

  if (isLoading) {
    return (
      <section className={styles.card}>
        {header}
        <div className={styles.emptyState}>…</div>
      </section>
    );
  }

  if (!occ) {
    return (
      <section className={styles.card}>
        {header}
        <div className={styles.emptyState}>
          <CalendarBlank size={20} />
          <span>{t("noUpcoming")}</span>
        </div>
      </section>
    );
  }

  const parts = formatJstDateParts(occ.startAt, locale);

  return (
    <section className={styles.card}>
      {header}
      <div className={styles.practiceBody}>
        <div className={styles.dateBlock}>
          <div className={styles.dateMonth}>
            {parts.month} · {parts.weekday}
          </div>
          <div className={styles.dateDay}>{parts.day}</div>
          <div className={styles.dateTime}>
            {formatJstTimeRange(occ.startAt, occ.endAt, locale)}
          </div>
        </div>
        <div className={styles.practiceInfo}>
          <div>
            <div className={styles.practiceTitle}>{occ.place}</div>
            <div className={styles.practiceMeta}>
              <span className={styles.metaItem}>
                <MapPin size={13} className={styles.metaIcon} />
                {occ.place}
              </span>
              {occ.instructorName ? (
                <span className={styles.metaItem}>
                  <User size={13} className={styles.metaIcon} />
                  {occ.instructorName}
                </span>
              ) : null}
            </div>
          </div>
          <div className={styles.attendance}>
            <div className={styles.statBlock}>
              <span className={`${styles.statValue} ${styles.statYes}`}>
                {occ.attendingCount}
              </span>
              <span className={styles.statLabel}>{t("attending")}</span>
            </div>
            <span className={styles.statDivider} />
            <div className={styles.statBlock}>
              <span className={`${styles.statValue} ${styles.statNo}`}>
                {occ.decliningCount}
              </span>
              <span className={styles.statLabel}>{t("declined")}</span>
            </div>
          </div>
          <div className={styles.actions}>
            {/* RsvpControl は myStatus をマウント時に取り込むため、再フェッチで
                myStatus が変わったら key で作り直して内部状態を同期させる。 */}
            <RsvpControl
              key={occ.myStatus ?? "none"}
              eventId={occ.eventId}
              occurrenceStart={occ.occurrenceStart}
              myStatus={occ.myStatus}
              onChanged={refresh}
            />
          </div>
        </div>
      </div>
    </section>
  );
}
