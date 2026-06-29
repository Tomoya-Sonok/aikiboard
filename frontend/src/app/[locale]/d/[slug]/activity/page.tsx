// アクティビティログ画面(要件 4.6、有料 + 管理者のみ)。
// 非メンバー/未認証は requireBoardMember が弾く。管理者でなければ公開ページへ。
// プランに activity_log が無ければ PRO アップセルを表示。

import { getTranslations } from "next-intl/server";
import { ActivityView } from "@/components/features/activity/ActivityView/ActivityView";
import { FeatureLocked } from "@/components/shared/FeatureLocked/FeatureLocked";
import { requireBoardMember } from "@/lib/boards/requireBoardMember";
import { redirect } from "@/lib/i18n/routing";

export default async function BoardActivityPage({
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

  if (!board.features.includes("activity_log")) {
    const t = await getTranslations("nav");
    return <FeatureLocked featureName={t("activity")} />;
  }

  return <ActivityView boardId={board.id} />;
}
