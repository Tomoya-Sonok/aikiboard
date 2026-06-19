// 会計画面(要件 4.8、有料 accounting、owner/admin のみ)。
// 非メンバー/未認証は requireBoardMember が弾く。非管理者はホームへ。プラン未契約は PRO アップセル。

import { getTranslations } from "next-intl/server";
import { FinanceView } from "@/components/features/finance/FinanceView/FinanceView";
import { FeatureLocked } from "@/components/shared/FeatureLocked/FeatureLocked";
import { requireBoardMember } from "@/lib/boards/requireBoardMember";
import { redirect } from "@/lib/i18n/routing";

export default async function BoardMoneyPage({
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

  if (!board.features.includes("accounting")) {
    const t = await getTranslations("nav");
    return <FeatureLocked featureName={t("money")} />;
  }

  return <FinanceView boardId={board.id} />;
}
