// アーカイブ画面(要件 4.4、有料 archive)。閲覧は全メンバー、作成/編集は管理者。
// 非メンバー/未認証は requireBoardMember が弾く。プランに archive が無ければ PRO アップセル。

import { getTranslations } from "next-intl/server";
import { ArchiveView } from "@/components/features/archive/ArchiveView/ArchiveView";
import { FeatureLocked } from "@/components/shared/FeatureLocked/FeatureLocked";
import { requireBoardMember } from "@/lib/boards/requireBoardMember";

export default async function BoardArchivePage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  const board = await requireBoardMember(slug, locale);

  if (!board.features.includes("archive")) {
    const t = await getTranslations("nav");
    return <FeatureLocked featureName={t("archive")} />;
  }

  const canManage =
    board.viewerRole === "owner" || board.viewerRole === "admin";

  return <ArchiveView boardId={board.id} canManage={canManage} />;
}
