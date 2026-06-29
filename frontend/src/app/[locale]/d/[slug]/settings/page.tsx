// ボード設定画面(owner/admin のみ)。公開ページの内容・テーマ・公開フラグを編集する。

import { SettingsView } from "@/components/features/settings/SettingsView/SettingsView";
import { requireBoardMember } from "@/lib/boards/requireBoardMember";
import { redirect } from "@/lib/i18n/routing";

export default async function BoardSettingsPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  const board = await requireBoardMember(slug, locale);

  const canManage =
    board.viewerRole === "owner" || board.viewerRole === "admin";
  if (!canManage) {
    redirect({ href: `/d/${slug}`, locale });
  }

  return <SettingsView boardId={board.id} slug={board.slug} />;
}
