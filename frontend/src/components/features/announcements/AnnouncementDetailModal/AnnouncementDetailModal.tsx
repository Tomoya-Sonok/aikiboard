"use client";

import { EnvelopeSimple } from "@phosphor-icons/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useRef } from "react";
import { Button } from "@/components/shared/Button/Button";
import { Dialog } from "@/components/shared/Dialog/Dialog";
import { RichTextView } from "@/components/shared/RichTextView/RichTextView";
import { type CalendarLocale, formatJstDateLong } from "@/lib/calendar/format";
import { trpcClient } from "@/lib/trpc/client";
import type {
  AnnouncementListResult,
  AnnouncementSummary,
} from "@/lib/types/announcement";
import type { ApiResponse } from "@/lib/types/api";
import type { AnnouncementEditing } from "../AnnouncementForm/AnnouncementForm";
import styles from "./AnnouncementDetailModal.module.css";

type Props = {
  boardId: string;
  summary: AnnouncementSummary;
  open: boolean;
  onClose: () => void;
  // 管理者操作(指定時のみ編集/公開/削除を表示)。
  canManage?: boolean;
  onEdit?: (editing: AnnouncementEditing) => void;
  onChanged?: () => void;
};

const listKey = (boardId: string) => ["announcements", boardId, "list"];
const unreadKey = (boardId: string) => [
  "announcements",
  boardId,
  "unreadCount",
];

// 一覧キャッシュの該当行を既読にする(楽観更新)。limit 違いの複数キャッシュに対応するため
// 部分一致(predicate)で全件更新する。
const markReadInLists = (
  old: ApiResponse<AnnouncementListResult> | undefined,
  id: string,
): ApiResponse<AnnouncementListResult> | undefined => {
  if (!old?.data) {
    return old;
  }
  return {
    ...old,
    data: {
      ...old.data,
      items: old.data.items.map((item) =>
        item.id === id ? { ...item, isRead: true } : item,
      ),
    },
  };
};

const decrementUnread = (
  old: ApiResponse<{ count: number }> | undefined,
): ApiResponse<{ count: number }> | undefined => {
  if (!old?.data) {
    return old;
  }
  return { ...old, data: { count: Math.max(0, old.data.count - 1) } };
};

export function AnnouncementDetailModal({
  boardId,
  summary,
  open,
  onClose,
  canManage = false,
  onEdit,
  onChanged,
}: Props) {
  const t = useTranslations("boards.announcements");
  const rawLocale = useLocale();
  const locale: CalendarLocale = rawLocale === "en" ? "en" : "ja";
  const queryClient = useQueryClient();

  const { data: detailRes, isLoading } = useQuery({
    queryKey: ["announcements", boardId, "detail", summary.id],
    queryFn: () => trpcClient.announcements.detail.query({ id: summary.id }),
    enabled: open,
  });
  const detail = detailRes?.data;

  const publishMutation = useMutation({
    mutationFn: () =>
      trpcClient.announcements.publish.mutate({ id: summary.id }),
    onSuccess: () => {
      onChanged?.();
      onClose();
    },
  });

  const removeMutation = useMutation({
    mutationFn: () =>
      trpcClient.announcements.remove.mutate({ id: summary.id }),
    onSuccess: () => {
      onChanged?.();
      onClose();
    },
  });

  const handlePublish = () => {
    const message = summary.notifyEmail
      ? t("publishConfirmEmail")
      : t("publishConfirm");
    if (window.confirm(message)) {
      publishMutation.mutate();
    }
  };

  const handleRemove = () => {
    if (window.confirm(t("deleteConfirm"))) {
      removeMutation.mutate();
    }
  };

  const handleEdit = () => {
    if (!detail || !onEdit) {
      return;
    }
    onEdit({
      id: detail.id,
      title: detail.title,
      bodyRich: detail.bodyRich,
      notifyEmail: detail.notifyEmail,
      isDraft: detail.isDraft,
    });
  };

  const busy = publishMutation.isPending || removeMutation.isPending;

  const markReadMutation = useMutation({
    mutationFn: () =>
      trpcClient.announcements.markRead.mutate({ id: summary.id }),
    onMutate: () => {
      queryClient.setQueriesData(
        { queryKey: listKey(boardId) },
        (old: ApiResponse<AnnouncementListResult> | undefined) =>
          markReadInLists(old, summary.id),
      );
      queryClient.setQueriesData(
        { queryKey: unreadKey(boardId) },
        decrementUnread,
      );
    },
    onError: () => {
      // ずれを残さないよう再同期する。
      queryClient.invalidateQueries({ queryKey: listKey(boardId) });
      queryClient.invalidateQueries({ queryKey: unreadKey(boardId) });
    },
  });

  // 公開済みかつ未読のものを開いたら、その時点で 1 度だけ既読にする。
  const firedRef = useRef(false);
  useEffect(() => {
    if (open && !firedRef.current && !summary.isDraft && !summary.isRead) {
      firedRef.current = true;
      markReadMutation.mutate();
    }
  }, [open, summary.isDraft, summary.isRead, markReadMutation.mutate]);

  return (
    <Dialog open={open} onClose={onClose} title={summary.title}>
      <div className={styles.body}>
        <div className={styles.meta}>
          {summary.isDraft ? (
            <span className={styles.draftBadge}>{t("draft")}</span>
          ) : (
            <span className={styles.date}>
              {summary.publishedAt
                ? formatJstDateLong(summary.publishedAt, locale)
                : ""}
            </span>
          )}
          {summary.authorName ? (
            <span className={styles.author}>{summary.authorName}</span>
          ) : null}
          {summary.notifyEmail ? (
            <span className={styles.notify} title={t("notifiedByEmail")}>
              <EnvelopeSimple size={13} />
              {t("notifiedByEmail")}
            </span>
          ) : null}
        </div>

        {isLoading ? (
          <p className={styles.loading}>{t("loading")}</p>
        ) : detail ? (
          <RichTextView doc={detail.bodyRich} />
        ) : (
          <p className={styles.loading}>{t("loadError")}</p>
        )}

        {canManage ? (
          <div className={styles.actions}>
            <Button
              variant="secondary"
              onClick={handleEdit}
              disabled={busy || !detail}
            >
              {t("edit")}
            </Button>
            {summary.isDraft ? (
              <Button onClick={handlePublish} disabled={busy}>
                {t("publish")}
              </Button>
            ) : null}
            <Button variant="secondary" onClick={handleRemove} disabled={busy}>
              {t("delete")}
            </Button>
          </div>
        ) : null}
      </div>
    </Dialog>
  );
}
