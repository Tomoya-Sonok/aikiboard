"use client";

import { useTranslations } from "next-intl";
import { Icon } from "@/components/shared/Icon/Icon";
import type { BoardDetail } from "@/lib/types/board";
import styles from "./BoardHeader.module.css";

type Props = {
  board: BoardDetail;
  title: string;
};

// 検索・通知は今は表示のみ(ダミー)。本実装は後続 PR。
export function BoardHeader({ board, title }: Props) {
  const t = useTranslations("nav");
  return (
    <header className={styles.header}>
      <div className={styles.titleArea}>
        <h1 className={styles.title}>{title}</h1>
        <span className={styles.boardName}>{board.name}</span>
      </div>
      <div className={styles.spacer} />
      <div className={styles.search}>
        <Icon name="search" size={13} />
        <span className={styles.searchPlaceholder}>
          {t("searchPlaceholder")}
        </span>
      </div>
      <button
        type="button"
        className={styles.iconBtn}
        aria-label={t("notifications")}
      >
        <Icon name="bell" size={15} />
      </button>
    </header>
  );
}
