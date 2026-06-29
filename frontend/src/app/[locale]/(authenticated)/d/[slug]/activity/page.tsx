// アクティビティログ画面(要件 4.6、有料 + 管理者のみ)。
// 管理者でなければ /home へ戻す。プランに activity_log が無ければ PRO アップセルを表示。

import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { ActivityView } from "@/components/features/activity/ActivityView/ActivityView";
import { FeatureLocked } from "@/components/shared/FeatureLocked/FeatureLocked";
import { getBoardDetail } from "@/lib/boards/getBoardDetail";
import { redirect } from "@/lib/i18n/routing";
import type { BoardDetail } from "@/lib/types/board";

export default async function BoardActivityPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;

  let board: BoardDetail | undefined;
  try {
    board = await getBoardDetail(slug);
  } catch {
    notFound();
  }
  if (!board) {
    notFound();
  }

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
