// ボード配下の共通レイアウト。メンバーガードを行い、シェル(サイドバー/ヘッダー)を被せる。
// 非公開 × 非メンバー / 存在しない slug は 404、公開ボードの非メンバーは所属一覧(/home)へ。

import { notFound } from "next/navigation";
import { BoardShell } from "@/components/features/boards/BoardShell/BoardShell";
import { RememberBoard } from "@/components/features/boards/RememberBoard/RememberBoard";
import { redirect } from "@/lib/i18n/routing";
import type { BoardDetail } from "@/lib/types/board";
import { createCallerFactory } from "@/server/trpc";
import { appRouter } from "@/server/trpc/router";

export default async function BoardLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;

  const caller = createCallerFactory(appRouter)({
    req: new Request("http://localhost"),
  });

  let board: BoardDetail | undefined;
  try {
    board = (await caller.boards.getBySlug({ slug })).data;
  } catch {
    notFound();
  }
  if (!board) {
    notFound();
  }
  // 非メンバーは(今は)ボードホームに入れない。所属解決(/home)へ戻す。
  if (!board.isMember) {
    redirect({ href: "/home", locale });
  }

  const boards = (await caller.boards.list()).data ?? [];

  return (
    <>
      <RememberBoard slug={slug} />
      <BoardShell board={board} boards={boards}>
        {children}
      </BoardShell>
    </>
  );
}
