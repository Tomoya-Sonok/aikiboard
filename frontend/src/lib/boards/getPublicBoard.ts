import { cache } from "react";
import type { PublicBoard } from "@/lib/types/publicBoard";
import { createCallerFactory } from "@/server/trpc";
import { appRouter } from "@/server/trpc/router";

// 公開ボードのプロフィールを取得する(anon)。非公開/存在しないボードは undefined。
// publicProcedure なので未認証でも呼べる。cache() で同一リクエスト内をデデュープ。
export const getPublicBoard = cache(
  async (slug: string): Promise<PublicBoard | undefined> => {
    const caller = createCallerFactory(appRouter)({
      req: new Request("http://localhost"),
    });
    try {
      return (await caller.publicBoards.board({ slug })).data;
    } catch {
      return undefined;
    }
  },
);
