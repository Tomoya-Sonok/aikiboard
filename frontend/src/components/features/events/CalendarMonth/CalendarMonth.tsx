"use client";

import { CaretLeft, CaretRight, Plus, Users } from "@phosphor-icons/react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import {
  type CalendarLocale,
  formatJstMonthTitle,
  formatJstTime,
} from "@/lib/calendar/format";
import {
  currentJstYearMonth,
  getMonthGrid,
  gridWindow,
  jstDateKey,
  shiftMonth,
} from "@/lib/calendar/monthGrid";
import { WEEKDAY_ORDER } from "@/lib/recurrence/recurrence";
import { trpcClient } from "@/lib/trpc/client";
import type { EventOccurrence } from "@/lib/types/event";
import {
  type EditMode,
  EventDetailModal,
} from "../EventDetailModal/EventDetailModal";
import { EventForm, type EventFormMode } from "../EventForm/EventForm";
import styles from "./CalendarMonth.module.css";

type Props = {
  boardId: string;
  canManage: boolean;
  memberCount: number;
};

type FormState = {
  mode: EventFormMode;
  occurrence?: EventOccurrence;
  defaultDate?: string;
};

export function CalendarMonth({ boardId, canManage, memberCount }: Props) {
  const t = useTranslations("boards.calendar");
  const rawLocale = useLocale();
  const locale: CalendarLocale = rawLocale === "en" ? "en" : "ja";
  const queryClient = useQueryClient();

  const [now] = useState(() => Date.now());
  const [view, setView] = useState(() => currentJstYearMonth(Date.now()));
  const [selected, setSelected] = useState<EventOccurrence | null>(null);
  const [formState, setFormState] = useState<FormState | null>(null);

  const cells = useMemo(
    () => getMonthGrid(view.year, view.month, now),
    [view, now],
  );
  const { from, to } = useMemo(() => gridWindow(cells), [cells]);

  const { data, isLoading } = useQuery({
    queryKey: ["events", boardId, view.year, view.month],
    queryFn: () => trpcClient.events.list.query({ boardId, from, to }),
  });

  const occurrences = useMemo(() => data?.data ?? [], [data]);

  const byDay = useMemo(() => {
    const map = new Map<string, EventOccurrence[]>();
    for (const occ of occurrences) {
      const key = jstDateKey(occ.startAt);
      const list = map.get(key) ?? [];
      list.push(occ);
      map.set(key, list);
    }
    for (const list of map.values()) {
      list.sort((a, b) => Date.parse(a.startAt) - Date.parse(b.startAt));
    }
    return map;
  }, [occurrences]);

  // この月(表示中の月)に属するオカレンスの件数と参加述べ人数。
  const summary = useMemo(() => {
    let events = 0;
    let attendees = 0;
    for (const occ of occurrences) {
      const key = jstDateKey(occ.startAt);
      const [y, m] = key.split("-").map(Number);
      if (y === view.year && m === view.month + 1) {
        events += 1;
        attendees += occ.attendingCount;
      }
    }
    return { events, attendees };
  }, [occurrences, view]);

  const refresh = () =>
    queryClient.invalidateQueries({ queryKey: ["events", boardId] });

  const goPrev = () => setView((v) => shiftMonth(v.year, v.month, -1));
  const goNext = () => setView((v) => shiftMonth(v.year, v.month, 1));
  const goToday = () => setView(currentJstYearMonth(Date.now()));

  const openCreate = (date?: string) =>
    setFormState({ mode: "create", defaultDate: date });

  const handleEdit = (mode: EditMode) => {
    if (selected) {
      setFormState({ mode, occurrence: selected });
      setSelected(null);
    }
  };

  return (
    <div className={styles.wrapper}>
      <div className={styles.toolbar}>
        <div className={styles.nav}>
          <button
            type="button"
            className={styles.navBtn}
            onClick={goPrev}
            aria-label={t("prevMonth")}
          >
            <CaretLeft size={15} />
          </button>
          <button
            type="button"
            className={styles.navBtn}
            onClick={goNext}
            aria-label={t("nextMonth")}
          >
            <CaretRight size={15} />
          </button>
        </div>

        <h2 className={styles.monthLabel}>
          {locale === "ja" ? (
            <>
              {view.year}
              <span className={styles.monthLabelUnit}>年</span>
              {view.month + 1}
              <span className={styles.monthLabelUnit}>月</span>
            </>
          ) : (
            formatJstMonthTitle(view.year, view.month, locale)
          )}
        </h2>

        <button type="button" className={styles.todayBtn} onClick={goToday}>
          {t("today")}
        </button>

        <div className={styles.viewToggle}>
          <button
            type="button"
            className={`${styles.viewBtn} ${styles.viewBtnActive}`}
          >
            {t("viewMonth")}
          </button>
          <button
            type="button"
            className={styles.viewBtn}
            disabled
            title={t("viewComingSoon")}
          >
            {t("viewWeek")}
          </button>
          <button
            type="button"
            className={styles.viewBtn}
            disabled
            title={t("viewComingSoon")}
          >
            {t("viewList")}
          </button>
        </div>

        <div className={styles.spacer} />

        <div className={styles.legend}>
          <span className={styles.legendItem}>
            <span className={`${styles.legendDot} ${styles.legendEvent}`} />
            {t("legendHasEvent")}
          </span>
          <span className={styles.legendItem}>
            <span className={`${styles.legendDot} ${styles.legendAll}`} />
            {t("legendAllAttending")}
          </span>
        </div>

        {canManage ? (
          <button
            type="button"
            className={styles.addBtn}
            onClick={() => openCreate()}
            aria-label={t("addEvent")}
          >
            <Plus size={14} weight="bold" />
            <span className={styles.addBtnLabel}>{t("addEvent")}</span>
          </button>
        ) : null}
      </div>

      <div className={styles.calendar} aria-busy={isLoading}>
        <div className={styles.weekHeader}>
          {WEEKDAY_ORDER.map((w, i) => (
            <div
              key={w}
              className={`${styles.weekHeaderCell} ${i === 0 ? styles.weekendSun : ""} ${i === 6 ? styles.weekendSat : ""}`}
            >
              {t(`weekdayShort.${w}`)}
            </div>
          ))}
        </div>

        <div className={styles.grid}>
          {cells.map((cell, index) => {
            const dayOccurrences = byDay.get(cell.key) ?? [];
            const col = index % 7;
            return (
              <div
                key={cell.key}
                className={`${styles.cell} ${cell.inCurrentMonth ? "" : styles.cellMuted} ${cell.isToday ? styles.cellToday : ""}`}
              >
                <div className={styles.cellHeader}>
                  <span
                    className={`${styles.dayNum} ${col === 0 ? styles.weekendSun : ""} ${col === 6 ? styles.weekendSat : ""}`}
                  >
                    {cell.day}
                  </span>
                  {canManage ? (
                    <button
                      type="button"
                      className={styles.addDay}
                      onClick={() => openCreate(cell.key)}
                      aria-label={`${t("addEvent")} ${cell.key}`}
                    >
                      <Plus size={12} />
                    </button>
                  ) : null}
                </div>
                <div className={styles.chips}>
                  {dayOccurrences.map((occ) => {
                    const isFull =
                      occ.attendingCount > 0 &&
                      occ.attendingCount >= memberCount;
                    return (
                      <button
                        type="button"
                        key={`${occ.eventId}-${occ.occurrenceStart}`}
                        className={styles.chip}
                        onClick={() => setSelected(occ)}
                      >
                        <span className={styles.chipTop}>
                          <span className={styles.chipTime}>
                            {formatJstTime(occ.startAt, locale)}
                          </span>
                          <span className={styles.chipPlace}>{occ.place}</span>
                        </span>
                        {occ.note ? (
                          <span className={styles.chipNote}>{occ.note}</span>
                        ) : null}
                        <span
                          className={styles.chipMeta}
                          title={
                            isFull
                              ? t("legendAllAttending")
                              : t("attendingCountLabel", {
                                  count: occ.attendingCount,
                                })
                          }
                        >
                          <Users size={11} weight="fill" />
                          <span
                            className={`${styles.chipCount} ${isFull ? styles.chipCountFull : ""}`}
                          >
                            {occ.attendingCount}
                          </span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className={styles.summary}>
        {t("monthSummary", {
          events: summary.events,
          attendees: summary.attendees,
        })}
      </div>

      {selected ? (
        <EventDetailModal
          occurrence={selected}
          open={selected !== null}
          onClose={() => setSelected(null)}
          onEdit={handleEdit}
          onChanged={refresh}
        />
      ) : null}

      {formState ? (
        <EventForm
          open={formState !== null}
          onClose={() => setFormState(null)}
          onSaved={refresh}
          boardId={boardId}
          mode={formState.mode}
          occurrence={formState.occurrence}
          defaultDate={formState.defaultDate}
        />
      ) : null}
    </div>
  );
}
