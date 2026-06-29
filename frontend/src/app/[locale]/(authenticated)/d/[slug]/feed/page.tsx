// 道場内フィード画面。シェル(サイドバー/ヘッダー)とメンバーガードは d/[slug]/layout.tsx が
// 提供する。ここでは board を再取得して boardId を渡す(投稿はメンバー全員可)。

import { notFound } from "next/navigation";
import { FeedView } from "@/components/features/feed/FeedView/FeedView";
import { getBoardDetail } from "@/lib/boards/getBoardDetail";
import type { BoardDetail } from "@/lib/types/board";

export default async function BoardFeedPage({
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

  return <FeedView boardId={board.id} />;
}
