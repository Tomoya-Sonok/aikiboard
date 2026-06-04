// ログイン後の着地点(リゾルバ)。所属ボードを解決して、デフォルトボードのホーム
// (/d/<slug>)へ送る。所属が無ければボード作成(/boards/new)へ誘導。
// アクティブボードは URL で表現する方針のため、ここは UI を持たず即リダイレクトする(ADR 0002 B-7)。

import { cookies } from "next/headers";
import {
  LAST_BOARD_COOKIE,
  resolveDefaultBoardSlug,
} from "@/lib/boards/resolveDefaultBoard";
import { redirect } from "@/lib/i18n/routing";
import { createCallerFactory } from "@/server/trpc";
import { appRouter } from "@/server/trpc/router";

export default async function HomePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  // 認証は (authenticated)/layout.tsx で済んでいる。所属ボードを取得して着地先を決める。
  // authenticatedProcedure は cookie 由来の session で検証するため、req はダミーでよい。
  const caller = createCallerFactory(appRouter)({
    req: new Request("http://localhost"),
  });
  const res = await caller.boards.list();
  const boards = res.data ?? [];

  const cookieStore = await cookies();
  const lastSlug = cookieStore.get(LAST_BOARD_COOKIE)?.value;
  const slug = resolveDefaultBoardSlug(boards, lastSlug);

  redirect({ href: slug ? `/d/${slug}` : "/boards/new", locale });
}
