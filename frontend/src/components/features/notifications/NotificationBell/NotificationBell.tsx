"use client";

import { Bell } from "@phosphor-icons/react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "@/lib/i18n/routing";
import { trpcClient } from "@/lib/trpc/client";
import type { NotificationItem } from "@/lib/types/notification";
import styles from "./NotificationBell.module.css";

type Props = {
  boardId: string;
  slug: string;
};

// 通知種別 → 表示文言の i18n キー。
const MESSAGE_KEY: Record<string, string> = {
  "announcement.published": "msgAnnouncement",
  "post.created": "msgPost",
  "thread.replied": "msgThread",
  "event.created": "msgEvent",
};

// 通知種別 → 遷移先セクション。
const sectionOf = (type: string): string => {
  if (type === "announcement.published") return "announce";
  if (type === "event.created") return "calendar";
  return "feed";
};

export function NotificationBell({ boardId, slug }: Props) {
  const t = useTranslations("boards.notifications");
  const router = useRouter();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  const { data: unreadRes } = useQuery({
    queryKey: ["notifications", boardId, "unreadCount"],
    queryFn: () => trpcClient.notifications.unreadCount.query({ boardId }),
    refetchInterval: 60_000,
  });
  const unread = unreadRes?.data?.count ?? 0;

  const { data: listRes, isLoading } = useQuery({
    queryKey: ["notifications", boardId, "list"],
    queryFn: () => trpcClient.notifications.list.query({ boardId, limit: 20 }),
    enabled: open,
  });
  const items = listRes?.data?.items ?? [];

  // 外側クリックで閉じる。
  useEffect(() => {
    if (!open) {
      return;
    }
    const onClick = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["notifications", boardId] });
  };

  const handleClick = async (item: NotificationItem) => {
    setOpen(false);
    if (!item.isRead) {
      await trpcClient.notifications.markRead.mutate({ id: item.id });
      invalidate();
    }
    router.push(`/d/${slug}/${sectionOf(item.type)}`);
  };

  const handleReadAll = async () => {
    await trpcClient.notifications.markAllRead.mutate({ boardId });
    invalidate();
  };

  const messageFor = (item: NotificationItem): string => {
    const key = MESSAGE_KEY[item.type];
    if (!key) {
      return item.title;
    }
    return t(key, { name: item.actorName || t("someone") });
  };

  return (
    <div className={styles.wrap} ref={wrapRef}>
      <button
        type="button"
        className={styles.iconBtn}
        onClick={() => setOpen((o) => !o)}
        aria-label={t("title")}
      >
        <Bell size={15} />
        {unread > 0 ? (
          <span className={styles.badge}>{unread > 99 ? "99+" : unread}</span>
        ) : null}
      </button>

      {open ? (
        <div className={styles.panel}>
          <div className={styles.head}>
            <span className={styles.headTitle}>{t("title")}</span>
            {unread > 0 ? (
              <button
                type="button"
                className={styles.readAll}
                onClick={handleReadAll}
              >
                {t("readAll")}
              </button>
            ) : null}
          </div>

          {isLoading && items.length === 0 ? (
            <p className={styles.empty}>{t("loading")}</p>
          ) : items.length === 0 ? (
            <p className={styles.empty}>{t("empty")}</p>
          ) : (
            <ul className={styles.list}>
              {items.map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    className={`${styles.item} ${item.isRead ? "" : styles.itemUnread}`}
                    onClick={() => handleClick(item)}
                  >
                    {!item.isRead ? (
                      <span className={styles.dot} aria-hidden="true" />
                    ) : (
                      <span className={styles.dotSpacer} aria-hidden="true" />
                    )}
                    <span className={styles.itemMain}>
                      <span className={styles.message}>{messageFor(item)}</span>
                      {item.title ? (
                        <span className={styles.itemTitle}>{item.title}</span>
                      ) : null}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  );
}
