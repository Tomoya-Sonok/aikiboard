"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/shared/Button/Button";
import { Dialog } from "@/components/shared/Dialog/Dialog";
import { Input } from "@/components/shared/Input/Input";
import { isoToJstDateTime, jstDateTimeToIso } from "@/lib/calendar/monthGrid";
import {
  buildRecurrence,
  defaultRecurrenceForm,
  parseRecurrenceToForm,
  type RecurrenceFormValue,
  WEEKDAY_ORDER,
} from "@/lib/recurrence/recurrence";
import { trpcClient } from "@/lib/trpc/client";
import type { EventOccurrence, Weekday } from "@/lib/types/event";
import styles from "./EventForm.module.css";

export type EventFormMode =
  | "create"
  | "editSingle"
  | "editSeries"
  | "editOccurrence";

type Props = {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  boardId: string;
  mode: EventFormMode;
  occurrence?: EventOccurrence;
  defaultDate?: string; // yyyy-mm-dd(作成時のプリフィル)
};

type Translate = (key: string) => string;

function createSchema(t: Translate) {
  return z.object({
    place: z
      .string()
      .min(1, t("form.validation.placeRequired"))
      .max(200, t("form.validation.placeMax")),
    instructorName: z.string().max(100).optional(),
    note: z.string().max(2000).optional(),
  });
}

type BaseValues = {
  place: string;
  instructorName?: string;
  note?: string;
};

export function EventForm({
  open,
  onClose,
  onSaved,
  boardId,
  mode,
  occurrence,
  defaultDate,
}: Props) {
  const t = useTranslations("boards.calendar");
  const schema = useMemo(() => createSchema(t), [t]);

  const showDateTime = mode !== "editSeries";
  const dateReadOnly = mode === "editOccurrence";
  const showRecurrence =
    mode === "create" || mode === "editSingle" || mode === "editSeries";

  // 初期日時(編集はオカレンスから、作成は defaultDate / デフォルト)。
  const initialDateTime = useMemo(() => {
    if (occurrence) {
      const s = isoToJstDateTime(occurrence.startAt);
      const e = isoToJstDateTime(occurrence.endAt);
      return { date: s.date, startTime: s.time, endTime: e.time };
    }
    return { date: defaultDate ?? "", startTime: "19:00", endTime: "21:00" };
  }, [occurrence, defaultDate]);

  const [date, setDate] = useState(initialDateTime.date);
  const [startTime, setStartTime] = useState(initialDateTime.startTime);
  const [endTime, setEndTime] = useState(initialDateTime.endTime);
  const [isPublic, setIsPublic] = useState(occurrence?.isPublic ?? true);
  const [recurrence, setRecurrence] = useState<RecurrenceFormValue>(
    mode === "editSingle" || mode === "editSeries"
      ? parseRecurrenceToForm(occurrence?.recurrenceRule)
      : defaultRecurrenceForm(),
  );
  const [localError, setLocalError] = useState<string | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<BaseValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      place: occurrence?.place ?? "",
      instructorName: occurrence?.instructorName ?? "",
      note: occurrence?.note ?? "",
    },
  });

  const mutation = useMutation({
    mutationFn: async (values: BaseValues) => {
      const place = values.place;
      const instructorName = values.instructorName?.trim() || null;
      const note = values.note?.trim() || null;

      let startAt: string | undefined;
      let endAt: string | undefined;
      if (showDateTime) {
        const s = jstDateTimeToIso(date, startTime);
        const e = jstDateTimeToIso(date, endTime);
        if (!s || !e || Date.parse(s) >= Date.parse(e)) {
          throw new Error("__time__");
        }
        startAt = s;
        endAt = e;
      }

      const rec = showRecurrence ? buildRecurrence(recurrence) : undefined;
      if (
        showRecurrence &&
        recurrence.freq === "WEEKLY" &&
        recurrence.byweekday.length === 0
      ) {
        throw new Error("__weekday__");
      }

      if (mode === "create") {
        return trpcClient.events.create.mutate({
          boardId,
          startAt: startAt as string,
          endAt: endAt as string,
          place,
          instructorName: instructorName ?? undefined,
          note: note ?? undefined,
          isPublic,
          recurrence: rec,
        });
      }
      if (!occurrence) {
        throw new Error("__state__");
      }
      if (mode === "editOccurrence") {
        return trpcClient.events.overrideOccurrence.mutate({
          eventId: occurrence.eventId,
          occurrenceStart: occurrence.occurrenceStart,
          startAt,
          endAt,
          place,
          instructorName,
          note,
        });
      }
      if (mode === "editSingle") {
        return trpcClient.events.update.mutate({
          eventId: occurrence.eventId,
          startAt,
          endAt,
          place,
          instructorName,
          note,
          isPublic,
          recurrence: rec,
        });
      }
      // editSeries(日時は触らない)
      return trpcClient.events.update.mutate({
        eventId: occurrence.eventId,
        place,
        instructorName,
        note,
        isPublic,
        recurrence: rec,
      });
    },
    onSuccess: () => {
      onSaved();
      onClose();
    },
    onError: (err) => {
      const msg = err instanceof Error ? err.message : "";
      if (msg === "__time__") {
        setLocalError(t("form.validation.timeOrder"));
      } else if (msg === "__weekday__") {
        setLocalError(t("form.validation.weekdayRequired"));
      } else {
        setServerError(t("form.error"));
      }
    },
  });

  const submit = (values: BaseValues) => {
    setLocalError(null);
    setServerError(null);
    if (showDateTime && !date) {
      setLocalError(t("form.validation.dateRequired"));
      return;
    }
    mutation.mutate(values);
  };

  const titleKey =
    mode === "create"
      ? "form.titleCreate"
      : mode === "editOccurrence"
        ? "form.titleEditOccurrence"
        : mode === "editSeries"
          ? "form.titleEditSeries"
          : "form.titleEdit";

  const toggleWeekday = (w: Weekday) =>
    setRecurrence((r) => ({
      ...r,
      byweekday: r.byweekday.includes(w)
        ? r.byweekday.filter((x) => x !== w)
        : [...r.byweekday, w],
    }));

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={t(titleKey)}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            {t("form.cancel")}
          </Button>
          <Button
            type="submit"
            variant="primary"
            disabled={mutation.isPending}
            onClick={handleSubmit(submit)}
          >
            {mode === "create" ? t("form.submitCreate") : t("form.submitSave")}
          </Button>
        </>
      }
    >
      <form className={styles.form} onSubmit={handleSubmit(submit)} noValidate>
        {serverError ? (
          <p className={styles.serverError} role="alert">
            {serverError}
          </p>
        ) : null}
        {localError ? (
          <p className={styles.serverError} role="alert">
            {localError}
          </p>
        ) : null}

        {showDateTime ? (
          <>
            <div className={styles.field}>
              <label className={styles.label} htmlFor="event-date">
                {t("form.date")}
              </label>
              <input
                id="event-date"
                type="date"
                className={styles.input}
                value={date}
                readOnly={dateReadOnly}
                disabled={dateReadOnly}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>
            <div className={styles.timeRow}>
              <div className={styles.field}>
                <label className={styles.label} htmlFor="event-start">
                  {t("form.startTime")}
                </label>
                <input
                  id="event-start"
                  type="time"
                  className={styles.input}
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                />
              </div>
              <div className={styles.field}>
                <label className={styles.label} htmlFor="event-end">
                  {t("form.endTime")}
                </label>
                <input
                  id="event-end"
                  type="time"
                  className={styles.input}
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                />
              </div>
            </div>
          </>
        ) : (
          <p className={styles.hint}>{t("form.editSeriesTimeHint")}</p>
        )}

        <Input
          label={t("form.place")}
          placeholder={t("form.placePlaceholder")}
          error={errors.place?.message}
          {...register("place")}
        />

        <Input
          label={t("form.instructor")}
          error={errors.instructorName?.message}
          {...register("instructorName")}
        />

        <div className={styles.field}>
          <label className={styles.label} htmlFor="event-note">
            {t("form.note")}
          </label>
          <textarea
            id="event-note"
            className={styles.textarea}
            rows={3}
            {...register("note")}
          />
        </div>

        {mode !== "editOccurrence" ? (
          <label className={styles.checkboxRow}>
            <input
              type="checkbox"
              checked={isPublic}
              onChange={(e) => setIsPublic(e.target.checked)}
            />
            <span>{t("form.isPublic")}</span>
          </label>
        ) : null}

        {showRecurrence ? (
          <fieldset className={styles.recurrence}>
            <legend className={styles.legend}>{t("form.recurrence")}</legend>
            <div className={styles.field}>
              <label className={styles.label} htmlFor="event-freq">
                {t("form.freq")}
              </label>
              <select
                id="event-freq"
                className={styles.input}
                value={recurrence.freq}
                onChange={(e) =>
                  setRecurrence((r) => ({
                    ...r,
                    freq: e.target.value as RecurrenceFormValue["freq"],
                  }))
                }
              >
                <option value="NONE">{t("form.freqNone")}</option>
                <option value="DAILY">{t("form.freqDaily")}</option>
                <option value="WEEKLY">{t("form.freqWeekly")}</option>
                <option value="MONTHLY">{t("form.freqMonthly")}</option>
              </select>
            </div>

            {recurrence.freq !== "NONE" ? (
              <>
                <div className={styles.field}>
                  <label className={styles.label} htmlFor="event-interval">
                    {t("form.interval")}
                  </label>
                  <input
                    id="event-interval"
                    type="number"
                    min={1}
                    max={99}
                    className={styles.intervalInput}
                    value={recurrence.interval}
                    onChange={(e) =>
                      setRecurrence((r) => ({
                        ...r,
                        interval: Math.max(1, Number(e.target.value) || 1),
                      }))
                    }
                  />
                </div>

                {recurrence.freq === "WEEKLY" ? (
                  <div className={styles.field}>
                    <span className={styles.label}>{t("form.weekdays")}</span>
                    <div className={styles.weekdays}>
                      {WEEKDAY_ORDER.map((w) => (
                        <label key={w} className={styles.weekday}>
                          <input
                            type="checkbox"
                            checked={recurrence.byweekday.includes(w)}
                            onChange={() => toggleWeekday(w)}
                          />
                          <span>{t(`weekdayShort.${w}`)}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                ) : null}

                <div className={styles.field}>
                  <span className={styles.label}>{t("form.end")}</span>
                  <div className={styles.endRow}>
                    <label className={styles.radio}>
                      <input
                        type="radio"
                        name="endMode"
                        checked={recurrence.endMode === "never"}
                        onChange={() =>
                          setRecurrence((r) => ({ ...r, endMode: "never" }))
                        }
                      />
                      <span>{t("form.endNever")}</span>
                    </label>
                    <label className={styles.radio}>
                      <input
                        type="radio"
                        name="endMode"
                        checked={recurrence.endMode === "until"}
                        onChange={() =>
                          setRecurrence((r) => ({ ...r, endMode: "until" }))
                        }
                      />
                      <span>{t("form.endUntil")}</span>
                    </label>
                    <label className={styles.radio}>
                      <input
                        type="radio"
                        name="endMode"
                        checked={recurrence.endMode === "count"}
                        onChange={() =>
                          setRecurrence((r) => ({ ...r, endMode: "count" }))
                        }
                      />
                      <span>{t("form.endCount")}</span>
                    </label>
                  </div>
                  {recurrence.endMode === "until" ? (
                    <input
                      type="date"
                      className={styles.input}
                      value={recurrence.until}
                      onChange={(e) =>
                        setRecurrence((r) => ({ ...r, until: e.target.value }))
                      }
                    />
                  ) : null}
                  {recurrence.endMode === "count" ? (
                    <input
                      type="number"
                      min={1}
                      max={366}
                      className={styles.intervalInput}
                      value={recurrence.count}
                      onChange={(e) =>
                        setRecurrence((r) => ({
                          ...r,
                          count: Math.max(1, Number(e.target.value) || 1),
                        }))
                      }
                    />
                  ) : null}
                </div>
              </>
            ) : null}
          </fieldset>
        ) : null}
      </form>
    </Dialog>
  );
}
