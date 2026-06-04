"use client";

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
// children には各ページ(Server Component)が入る。ヘッダーのタイトルは URL から動的に解決する。
export function BoardShell({ board, boards, children }: Props) {
  return (
    <div className={styles.shell}>
      <BoardSidebar boards={boards} activeSlug={board.slug} />
      <div className={styles.main}>
        <BoardHeader board={board} />
        <main className={styles.content}>{children}</main>
      </div>
    </div>
  );
}
