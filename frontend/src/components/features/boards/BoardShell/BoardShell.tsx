"use client";

import { useTranslations } from "next-intl";
import type { ReactNode } from "react";
import type { BoardDetail, BoardSummary } from "@/lib/types/board";
import { useUiStore } from "@/stores/uiStore";
import { BoardHeader } from "../BoardHeader/BoardHeader";
import { BoardSidebar } from "../BoardSidebar/BoardSidebar";
import styles from "./BoardShell.module.css";

type Props = {
  board: BoardDetail;
  boards: BoardSummary[];
  children: ReactNode;
};

// ボード配下の共通シェル。サイドバー + ヘッダー + コンテンツ領域。
// children には各ページ(Server Component)が入る。ヘッダーのタイトルは URL から動的に解決する。
export function BoardShell({ board, boards, children }: Props) {
  const t = useTranslations("nav");
  const mobileNavOpen = useUiStore((s) => s.mobileNavOpen);
  const closeMobileNav = useUiStore((s) => s.closeMobileNav);

  return (
    <div className={styles.shell}>
      <BoardSidebar boards={boards} activeSlug={board.slug} />
      {/* SP: ドロワー表示中の背景。タップで閉じる(PC では media query で非表示)。 */}
      {mobileNavOpen ? (
        <button
          type="button"
          className={styles.backdrop}
          aria-label={t("closeNav")}
          onClick={closeMobileNav}
        />
      ) : null}
      <div className={styles.main}>
        <BoardHeader board={board} />
        <main className={styles.content}>{children}</main>
      </div>
    </div>
  );
}
