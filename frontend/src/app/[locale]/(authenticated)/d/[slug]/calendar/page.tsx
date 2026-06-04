// 稽古カレンダー画面。シェル(サイドバー/ヘッダー)とメンバーガードは d/[slug]/layout.tsx が
// 提供する。ここでは board を再取得して boardId と管理者判定(viewerRole)を CalendarMonth に渡す。

import { notFound } from "next/navigation";
import { CalendarMonth } from "@/components/features/events/CalendarMonth/CalendarMonth";
import type { BoardDetail } from "@/lib/types/board";
import { createCallerFactory } from "@/server/trpc";
import { appRouter } from "@/server/trpc/router";

export default async function BoardCalendarPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { slug } = await params;

  const caller = createCallerFactory(appRouter)({
    req: new Request("http://localhost"),
  });

  let board: BoardDetail | undefined;
  try {
    board = (await caller.boards.getBySlug({ slug })).data;
  } catch {
    notFound();
  }
  if (!board) {
    notFound();
  }

  const canManage =
    board.viewerRole === "owner" || board.viewerRole === "admin";

  return <CalendarMonth boardId={board.id} canManage={canManage} />;
}
