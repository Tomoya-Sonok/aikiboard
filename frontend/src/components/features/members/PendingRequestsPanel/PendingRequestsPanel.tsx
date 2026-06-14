"use client";

import { Check, UserPlus, X } from "@phosphor-icons/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { Avatar } from "@/components/shared/Avatar/Avatar";
import { type CalendarLocale, formatJstDateLong } from "@/lib/calendar/format";
import { trpcClient } from "@/lib/trpc/client";
import styles from "./PendingRequestsPanel.module.css";

type Props = {
  boardId: string;
};

// AikiNote 道場からの参加申請の承認/却下(管理者向け)。承認待ちが無ければ何も表示しない。
export function PendingRequestsPanel({ boardId }: Props) {
  const t = useTranslations("boards.requests");
  const rawLocale = useLocale();
  const locale: CalendarLocale = rawLocale === "en" ? "en" : "ja";
  const queryClient = useQueryClient();

  const { data } = useQuery({
    queryKey: ["membershipRequests", boardId],
    queryFn: () =>
      trpcClient.membershipRequests.listForBoard.query({ boardId }),
  });
  const requests = data?.data ?? [];

  const refresh = () => {
    queryClient.invalidateQueries({
      queryKey: ["membershipRequests", boardId],
    });
    // 承認でメンバーが増えるため一覧も更新。
    queryClient.invalidateQueries({ queryKey: ["members", boardId] });
  };

  const approveMutation = useMutation({
    mutationFn: (id: string) =>
      trpcClient.membershipRequests.approve.mutate({ id }),
    onSuccess: refresh,
  });
  const rejectMutation = useMutation({
    mutationFn: (id: string) =>
      trpcClient.membershipRequests.reject.mutate({ id }),
    onSuccess: refresh,
  });

  const busy = approveMutation.isPending || rejectMutation.isPending;

  if (requests.length === 0) {
    return null;
  }

  return (
    <section className={styles.panel}>
      <div className={styles.head}>
        <span className={styles.title}>
          <UserPlus size={16} className={styles.titleIcon} />
          {t("title")}
        </span>
        <span className={styles.countPill}>{requests.length}</span>
      </div>

      <ul className={styles.list}>
        {requests.map((req) => (
          <li key={req.id} className={styles.item}>
            <Avatar
              name={req.username}
              imageUrl={req.profileImageUrl}
              size={36}
            />
            <div className={styles.info}>
              <span className={styles.name}>
                {req.username || t("unknownUser")}
              </span>
              {req.message ? (
                <span className={styles.message}>{req.message}</span>
              ) : null}
              <span className={styles.meta}>
                {t("requestedAt", {
                  date: formatJstDateLong(req.createdAt, locale),
                })}
              </span>
            </div>
            <div className={styles.actions}>
              <button
                type="button"
                className={`${styles.action} ${styles.approve}`}
                onClick={() => approveMutation.mutate(req.id)}
                disabled={busy}
              >
                <Check size={14} weight="bold" />
                {t("approve")}
              </button>
              <button
                type="button"
                className={`${styles.action} ${styles.reject}`}
                onClick={() => rejectMutation.mutate(req.id)}
                disabled={busy}
                aria-label={t("reject")}
                title={t("reject")}
              >
                <X size={14} />
              </button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
