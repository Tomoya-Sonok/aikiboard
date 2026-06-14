// メンバー管理画面。シェル/メンバーガードは d/[slug]/layout.tsx が提供する。
// board を再取得して boardId と管理者判定(viewerRole)を MembersView に渡す。

import { notFound } from "next/navigation";
import { MembersView } from "@/components/features/members/MembersView/MembersView";
import { getBoardDetail } from "@/lib/boards/getBoardDetail";
import type { BoardDetail } from "@/lib/types/board";

export default async function BoardMembersPage({
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

  return <MembersView boardId={board.id} canManage={canManage} />;
}
