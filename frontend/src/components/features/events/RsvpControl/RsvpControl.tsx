"use client";

import { Check, X } from "@phosphor-icons/react";
import { useMutation } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useRef, useState } from "react";
import { trpcClient } from "@/lib/trpc/client";
import type { RsvpStatus } from "@/lib/types/event";
import styles from "./RsvpControl.module.css";

type Props = {
  eventId: string;
  occurrenceStart: string;
  myStatus: RsvpStatus | null;
  onChanged: () => void;
};

// 自分の出欠表明(参加/不参加)。同じボタンの再クリックで未回答に戻す。楽観更新。
export function RsvpControl({
  eventId,
  occurrenceStart,
  myStatus,
  onChanged,
}: Props) {
  const t = useTranslations("boards.calendar");
  // myStatus はマウント時にだけ取り込む。外部(再フェッチ)で myStatus が変わったら
  // 反映されるよう、利用側はアンマウント(モーダル)か key 付与(常時マウント箇所)で
  // 作り直すこと。
  const [optimistic, setOptimistic] = useState<RsvpStatus | null>(myStatus);
  // ロールバック先は「直前に確定した値」。初期はマウント時点の myStatus。
  const confirmedRef = useRef<RsvpStatus | null>(myStatus);

  const setMutation = useMutation({
    mutationFn: (status: RsvpStatus) =>
      trpcClient.events.setRsvp.mutate({ eventId, occurrenceStart, status }),
    onSuccess: (_data, status) => {
      confirmedRef.current = status;
      onChanged();
    },
    onError: () => setOptimistic(confirmedRef.current),
  });
  const clearMutation = useMutation({
    mutationFn: () =>
      trpcClient.events.clearRsvp.mutate({ eventId, occurrenceStart }),
    onSuccess: () => {
      confirmedRef.current = null;
      onChanged();
    },
    onError: () => setOptimistic(confirmedRef.current),
  });

  const busy = setMutation.isPending || clearMutation.isPending;

  const choose = (status: RsvpStatus) => {
    if (busy) {
      return;
    }
    if (optimistic === status) {
      setOptimistic(null);
      clearMutation.mutate();
    } else {
      setOptimistic(status);
      setMutation.mutate(status);
    }
  };

  return (
    <div className={styles.control}>
      <button
        type="button"
        className={`${styles.btn} ${optimistic === "attend" ? styles.attendActive : ""}`}
        onClick={() => choose("attend")}
        disabled={busy}
        aria-pressed={optimistic === "attend"}
      >
        <Check size={14} />
        <span>{t("rsvp.attend")}</span>
      </button>
      <button
        type="button"
        className={`${styles.btn} ${optimistic === "decline" ? styles.declineActive : ""}`}
        onClick={() => choose("decline")}
        disabled={busy}
        aria-pressed={optimistic === "decline"}
      >
        <X size={14} />
        <span>{t("rsvp.decline")}</span>
      </button>
    </div>
  );
}
