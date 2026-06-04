// ボードホーム(ダッシュボード)。今は配線確認のための最小表示。
// シェル(サイドバー/ヘッダー)とダッシュボードカードは後続 PR で追加する。
// メンバーのみ閲覧可。非メンバー / 非公開 / 存在しない slug は 404。

import { notFound } from "next/navigation";
import type { BoardDetail } from "@/lib/types/board";
import { createCallerFactory } from "@/server/trpc";
import { appRouter } from "@/server/trpc/router";

export default async function BoardHomePage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { slug } = await params;

  const caller = createCallerFactory(appRouter)({
    req: new Request("http://localhost"),
  });

  let board: BoardDetail | undefined;
  try {
    const res = await caller.boards.getBySlug({ slug });
    board = res.data;
  } catch {
    // 非公開ボード × 非メンバー / 存在しない slug は backend が 404 を返す。
    notFound();
  }
  if (!board?.isMember) {
    notFound();
  }

  return (
    <main>
      <h1>{board.name}</h1>
      <p>あなたのロール: {board.viewerRole}</p>
      <p>
        メンバー: {board.memberCount} 名 / プラン: {board.planName}
      </p>
    </main>
  );
}
