// お知らせ画面(メンバー専用)。シェルは d/[slug]/layout.tsx が提供。

import { AnnouncementsView } from "@/components/features/announcements/AnnouncementsView/AnnouncementsView";
import { requireBoardMember } from "@/lib/boards/requireBoardMember";

export default async function BoardAnnouncePage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  const board = await requireBoardMember(slug, locale);

  const canManage =
    board.viewerRole === "owner" || board.viewerRole === "admin";

  return <AnnouncementsView boardId={board.id} canManage={canManage} />;
}
