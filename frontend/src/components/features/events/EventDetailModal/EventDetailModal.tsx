"use client";

import {
  ArrowsClockwise,
  Eye,
  EyeSlash,
  MapPin,
  User,
} from "@phosphor-icons/react";
import { useMutation } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { Button } from "@/components/shared/Button/Button";
import { Dialog } from "@/components/shared/Dialog/Dialog";
import {
  type CalendarLocale,
  formatJstDateLong,
  formatJstTimeRange,
} from "@/lib/calendar/format";
import { describeRecurrence } from "@/lib/recurrence/recurrence";
import { trpcClient } from "@/lib/trpc/client";
import type { EventOccurrence } from "@/lib/types/event";
import styles from "./EventDetailModal.module.css";

export type EditMode = "editSingle" | "editSeries" | "editOccurrence";

type Props = {
  occurrence: EventOccurrence;
  open: boolean;
  onClose: () => void;
  onEdit: (mode: EditMode) => void;
  onChanged: () => void;
};

export function EventDetailModal({
  occurrence,
  open,
  onClose,
  onEdit,
  onChanged,
}: Props) {
  const t = useTranslations("boards.calendar");
  const rawLocale = useLocale();
  const locale: CalendarLocale = rawLocale === "en" ? "en" : "ja";

  const cancelMutation = useMutation({
    mutationFn: () =>
      trpcClient.events.cancelOccurrence.mutate({
        eventId: occurrence.eventId,
        occurrenceStart: occurrence.occurrenceStart,
      }),
    onSuccess: () => {
      onChanged();
      onClose();
    },
  });

  const removeMutation = useMutation({
    mutationFn: () =>
      trpcClient.events.remove.mutate({ eventId: occurrence.eventId }),
    onSuccess: () => {
      onChanged();
      onClose();
    },
  });

  const recurrenceText = occurrence.isRecurring
    ? describeRecurrence(occurrence.recurrenceRule, t)
    : "";

  const handleCancelOccurrence = () => {
    if (window.confirm(t("detail.cancelConfirm"))) {
      cancelMutation.mutate();
    }
  };
  const handleRemove = () => {
    if (window.confirm(t("detail.deleteConfirm"))) {
      removeMutation.mutate();
    }
  };

  const busy = cancelMutation.isPending || removeMutation.isPending;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={formatJstDateLong(occurrence.startAt, locale)}
    >
      <div className={styles.body}>
        <p className={styles.time}>
          {formatJstTimeRange(occurrence.startAt, occurrence.endAt, locale)}
        </p>

        <div className={styles.row}>
          <MapPin size={16} className={styles.icon} />
          <span>{occurrence.place}</span>
        </div>

        {occurrence.instructorName ? (
          <div className={styles.row}>
            <User size={16} className={styles.icon} />
            <span>{occurrence.instructorName}</span>
          </div>
        ) : null}

        {recurrenceText ? (
          <div className={styles.row}>
            <ArrowsClockwise size={16} className={styles.icon} />
            <span>{recurrenceText}</span>
          </div>
        ) : null}

        <div className={styles.row}>
          {occurrence.isPublic ? (
            <>
              <Eye size={16} className={styles.icon} />
              <span>{t("detail.public")}</span>
            </>
          ) : (
            <>
              <EyeSlash size={16} className={styles.icon} />
              <span>{t("detail.private")}</span>
            </>
          )}
        </div>

        {occurrence.isOverridden ? (
          <p className={styles.badge}>{t("detail.overridden")}</p>
        ) : null}

        {occurrence.note ? (
          <p className={styles.note}>{occurrence.note}</p>
        ) : null}

        <div className={styles.counts}>
          <span className={styles.countAttend}>
            {t("detail.attending")}: {occurrence.attendingCount}
          </span>
          <span className={styles.countDecline}>
            {t("detail.declined")}: {occurrence.decliningCount}
          </span>
        </div>

        {occurrence.canManage ? (
          <div className={styles.actions}>
            {occurrence.isRecurring ? (
              <>
                <Button
                  variant="secondary"
                  onClick={() => onEdit("editOccurrence")}
                >
                  {t("detail.editThis")}
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => onEdit("editSeries")}
                >
                  {t("detail.editSeries")}
                </Button>
                <Button
                  variant="secondary"
                  onClick={handleCancelOccurrence}
                  disabled={busy}
                >
                  {t("detail.cancelThis")}
                </Button>
                <Button
                  variant="secondary"
                  onClick={handleRemove}
                  disabled={busy}
                >
                  {t("detail.deleteSeries")}
                </Button>
              </>
            ) : (
              <>
                <Button
                  variant="secondary"
                  onClick={() => onEdit("editSingle")}
                >
                  {t("detail.edit")}
                </Button>
                <Button
                  variant="secondary"
                  onClick={handleRemove}
                  disabled={busy}
                >
                  {t("detail.delete")}
                </Button>
              </>
            )}
          </div>
        ) : null}
      </div>
    </Dialog>
  );
}
