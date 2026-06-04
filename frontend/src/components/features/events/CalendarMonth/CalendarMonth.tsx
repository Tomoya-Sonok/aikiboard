"use client";

import { CaretLeft, CaretRight, Plus } from "@phosphor-icons/react";
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
};

type FormState = {
  mode: EventFormMode;
  occurrence?: EventOccurrence;
  defaultDate?: string;
};

export function CalendarMonth({ boardId, canManage }: Props) {
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

  const statusClass = (occ: EventOccurrence) =>
    occ.myStatus === "attend"
      ? styles.dotAttend
      : occ.myStatus === "decline"
        ? styles.dotDecline
        : styles.dotNone;

  return (
    <div className={styles.wrapper}>
      <div className={styles.header}>
        <h1 className={styles.title}>{t("title")}</h1>
        <div className={styles.controls}>
          <button
            type="button"
            className={styles.navBtn}
            onClick={goPrev}
            aria-label={t("prevMonth")}
          >
            <CaretLeft size={16} />
          </button>
          <span className={styles.monthLabel}>
            {formatJstMonthTitle(view.year, view.month, locale)}
          </span>
          <button
            type="button"
            className={styles.navBtn}
            onClick={goNext}
            aria-label={t("nextMonth")}
          >
            <CaretRight size={16} />
          </button>
          <button type="button" className={styles.todayBtn} onClick={goToday}>
            {t("today")}
          </button>
          {canManage ? (
            <button
              type="button"
              className={styles.addBtn}
              onClick={() => openCreate()}
            >
              <Plus size={14} />
              <span>{t("addEvent")}</span>
            </button>
          ) : null}
        </div>
      </div>

      <div className={styles.weekHeader}>
        {WEEKDAY_ORDER.map((w) => (
          <div key={w} className={styles.weekHeaderCell}>
            {t(`weekdayShort.${w}`)}
          </div>
        ))}
      </div>

      <div className={styles.grid} aria-busy={isLoading}>
        {cells.map((cell) => {
          const dayOccurrences = byDay.get(cell.key) ?? [];
          return (
            <div
              key={cell.key}
              className={`${styles.cell} ${cell.inCurrentMonth ? "" : styles.cellMuted} ${cell.isToday ? styles.cellToday : ""}`}
            >
              <div className={styles.cellHeader}>
                <span className={styles.dayNum}>{cell.day}</span>
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
                {dayOccurrences.map((occ) => (
                  <button
                    type="button"
                    key={`${occ.eventId}-${occ.occurrenceStart}`}
                    className={styles.chip}
                    onClick={() => setSelected(occ)}
                  >
                    <span className={`${styles.dot} ${statusClass(occ)}`} />
                    <span className={styles.chipTime}>
                      {formatJstTime(occ.startAt, locale)}
                    </span>
                    <span className={styles.chipPlace}>{occ.place}</span>
                  </button>
                ))}
              </div>
            </div>
          );
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
