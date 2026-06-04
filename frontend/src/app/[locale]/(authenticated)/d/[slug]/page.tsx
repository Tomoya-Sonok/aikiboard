// ボードホームのダッシュボード。シェル(サイドバー/ヘッダー)とメンバーガードは layout.tsx が提供。
// 「次の稽古」を実データ表示するため board を再取得して boardId / slug を渡す。

import { notFound } from "next/navigation";
import { DashboardCards } from "@/components/features/boards/dashboard/DashboardCards";
import { getBoardDetail } from "@/lib/boards/getBoardDetail";
import type { BoardDetail } from "@/lib/types/board";

export default async function BoardHomePage({
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

  return <DashboardCards boardId={board.id} slug={board.slug} />;
}
