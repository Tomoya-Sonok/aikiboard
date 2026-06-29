// 稽古カレンダー画面(メンバー専用)。シェルは d/[slug]/layout.tsx が提供。
// `/d/<slug>` は (authenticated) グループ外のため requireBoardMember で自衛する。

import { CalendarMonth } from "@/components/features/events/CalendarMonth/CalendarMonth";
import { requireBoardMember } from "@/lib/boards/requireBoardMember";

export default async function BoardCalendarPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  const board = await requireBoardMember(slug, locale);

  const canManage =
    board.viewerRole === "owner" || board.viewerRole === "admin";

  return (
    <CalendarMonth
      boardId={board.id}
      canManage={canManage}
      memberCount={board.memberCount}
    />
  );
}
