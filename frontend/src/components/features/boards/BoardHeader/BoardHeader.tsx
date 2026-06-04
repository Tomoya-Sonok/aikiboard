"use client";

import { Bell, MagnifyingGlass } from "@phosphor-icons/react";
import { useTranslations } from "next-intl";
import { usePathname } from "@/lib/i18n/routing";
import type { BoardDetail } from "@/lib/types/board";
import styles from "./BoardHeader.module.css";

type Props = {
  board: BoardDetail;
};

// 現在の URL セグメントからセクション名を求める(/d/<slug> はホーム)。
function sectionFromPath(pathname: string, slug: string): string {
  const segments = pathname.split("/").filter(Boolean);
  const dIndex = segments.indexOf("d");
  if (dIndex === -1 || segments[dIndex + 1] !== slug) {
    return "home";
  }
  return segments[dIndex + 2] ?? "home";
}

// 検索・通知は今は表示のみ(ダミー)。本実装は後続 PR。
// タイトルは URL セグメント(home / calendar 等)から動的に解決する。
export function BoardHeader({ board }: Props) {
  const t = useTranslations("nav");
  const pathname = usePathname();
  const section = sectionFromPath(pathname, board.slug);
  const title = t(section);
  return (
    <header className={styles.header}>
      <div className={styles.titleArea}>
        <h1 className={styles.title}>{title}</h1>
        <span className={styles.boardName}>{board.name}</span>
      </div>
      <div className={styles.spacer} />
      <div className={styles.search}>
        <MagnifyingGlass size={13} />
        <span className={styles.searchPlaceholder}>
          {t("searchPlaceholder")}
        </span>
      </div>
      <button
        type="button"
        className={styles.iconBtn}
        aria-label={t("notifications")}
      >
        <Bell size={15} />
      </button>
    </header>
  );
}
