// 道場内フィード画面(メンバー専用)。シェルは d/[slug]/layout.tsx が提供。

import { FeedView } from "@/components/features/feed/FeedView/FeedView";
import { requireBoardMember } from "@/lib/boards/requireBoardMember";

export default async function BoardFeedPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  const board = await requireBoardMember(slug, locale);

  return <FeedView boardId={board.id} />;
}
