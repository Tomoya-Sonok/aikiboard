// Todo 管理画面(owner/admin のみ)。member は参照不可(requireBoardMember + 管理者判定で弾く)。

import { TodoView } from "@/components/features/todo/TodoView/TodoView";
import { requireBoardMember } from "@/lib/boards/requireBoardMember";
import { redirect } from "@/lib/i18n/routing";

export default async function BoardTodoPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  const board = await requireBoardMember(slug, locale);

  const canManage =
    board.viewerRole === "owner" || board.viewerRole === "admin";
  if (!canManage) {
    // member はホーム(公開ページ/ダッシュボード)へ。Todo は参照させない。
    redirect({ href: `/d/${slug}`, locale });
  }

  return <TodoView boardId={board.id} />;
}
