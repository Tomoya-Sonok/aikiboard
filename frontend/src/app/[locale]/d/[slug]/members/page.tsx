// メンバー管理画面(メンバー専用)。シェルは d/[slug]/layout.tsx が提供。

import { MembersView } from "@/components/features/members/MembersView/MembersView";
import { requireBoardMember } from "@/lib/boards/requireBoardMember";

export default async function BoardMembersPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  const board = await requireBoardMember(slug, locale);

  const canManage =
    board.viewerRole === "owner" || board.viewerRole === "admin";

  return <MembersView boardId={board.id} canManage={canManage} />;
}
