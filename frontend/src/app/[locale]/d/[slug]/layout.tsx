// ボード配下の共通レイアウト。`/d/<slug>` は (authenticated) グループ外にあるため、
// ここで認証/メンバー判定を行う:
//   - メンバー(ログイン済み)  → シェル(サイドバー/ヘッダー)を被せて会員向け画面を表示
//   - 未認証 / 非メンバー       → シェル無しで children をそのまま描く
//       (home は公開ページ、メンバー専用のサブ画面は各ページが requireBoardMember で自衛)

import { BoardShell } from "@/components/features/boards/BoardShell/BoardShell";
import { RememberBoard } from "@/components/features/boards/RememberBoard/RememberBoard";
import { getBoardDetail } from "@/lib/boards/getBoardDetail";
import { getServerSupabase } from "@/lib/supabase/server";
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
  const { slug } = await params;

  const supabase = await getServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    let board: BoardDetail | undefined;
    try {
      board = await getBoardDetail(slug);
    } catch {
      board = undefined;
    }
    if (board?.isMember) {
      const caller = createCallerFactory(appRouter)({
        req: new Request("http://localhost"),
      });
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
  }

  // 未認証 / 非メンバー: 公開ページ(home)や各サブページのガードに委ねる。
  return <>{children}</>;
}
