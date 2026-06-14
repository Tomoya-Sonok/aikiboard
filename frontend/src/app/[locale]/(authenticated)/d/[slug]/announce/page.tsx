// お知らせ画面。シェル(サイドバー/ヘッダー)とメンバーガードは d/[slug]/layout.tsx が
// 提供する。ここでは board を再取得して boardId と管理者判定(viewerRole)を渡す。

import { notFound } from "next/navigation";
import { AnnouncementsView } from "@/components/features/announcements/AnnouncementsView/AnnouncementsView";
import { getBoardDetail } from "@/lib/boards/getBoardDetail";
import type { BoardDetail } from "@/lib/types/board";

export default async function BoardAnnouncePage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { slug } = await params;

  let board: BoardDetail | undefined;
  try {
    board = await getBoardDetail(slug);
  } catch {
    notFound();
  }
  if (!board) {
    notFound();
  }

  const canManage =
    board.viewerRole === "owner" || board.viewerRole === "admin";

  return <AnnouncementsView boardId={board.id} canManage={canManage} />;
}
