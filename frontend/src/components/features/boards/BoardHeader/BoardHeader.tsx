"use client";

import { Bell, CaretDown, Globe, MagnifyingGlass } from "@phosphor-icons/react";
import { useTranslations } from "next-intl";
import { useAuth } from "@/lib/hooks/useAuth";
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

// 検索・通知・言語切替・アカウントは今は表示のみ(ダミー)。本実装は後続 PR。
// タイトルは URL セグメント(home / calendar 等)から動的に解決する。
// カレンダーは画面側の見出しを廃し、ヘッダーを唯一の見出しにするため
// nav ラベルではなく稽古カレンダーの正式名称を使う。
export function BoardHeader({ board }: Props) {
  const t = useTranslations();
  const pathname = usePathname();
  const { user } = useAuth();
  const section = sectionFromPath(pathname, board.slug);
  const title =
    section === "calendar" ? t("boards.calendar.title") : t(`nav.${section}`);

  const userLabel = user?.username ?? user?.email ?? "";
  const userInitial = (userLabel || "?").charAt(0).toUpperCase();

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
          {t("nav.searchPlaceholder")}
        </span>
        <span className={styles.searchHint}>⌘K</span>
      </div>
      <button
        type="button"
        className={styles.iconBtn}
        aria-label={t("nav.language")}
      >
        <Globe size={15} />
      </button>
      <button
        type="button"
        className={styles.iconBtn}
        aria-label={t("nav.notifications")}
      >
        <Bell size={15} />
        <span className={styles.notifyDot} />
      </button>
      <div className={styles.divider} />
      <button
        type="button"
        className={styles.account}
        aria-label={t("nav.account")}
      >
        <span className={styles.accountAvatar}>{userInitial}</span>
        <CaretDown size={12} />
      </button>
    </header>
  );
}
