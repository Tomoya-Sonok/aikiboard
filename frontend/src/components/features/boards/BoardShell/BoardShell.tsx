"use client";

import { useTranslations } from "next-intl";
import type { ReactNode } from "react";
import type { BoardDetail, BoardSummary } from "@/lib/types/board";
import { BoardHeader } from "../BoardHeader/BoardHeader";
import { BoardSidebar } from "../BoardSidebar/BoardSidebar";
import styles from "./BoardShell.module.css";

type Props = {
  board: BoardDetail;
  boards: BoardSummary[];
  children: ReactNode;
};

// ボード配下の共通シェル。サイドバー + ヘッダー + コンテンツ領域。
// children には各ページ(Server Component)が入る。
export function BoardShell({ board, boards, children }: Props) {
  const t = useTranslations("nav");
  return (
    <div className={styles.shell}>
      <BoardSidebar boards={boards} activeSlug={board.slug} />
      <div className={styles.main}>
        <BoardHeader board={board} title={t("home")} />
        <main className={styles.content}>{children}</main>
      </div>
    </div>
  );
}
