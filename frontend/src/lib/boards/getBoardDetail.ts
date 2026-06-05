import { cache } from "react";
import type { BoardDetail } from "@/lib/types/board";
import { createCallerFactory } from "@/server/trpc";
import { appRouter } from "@/server/trpc/router";

// ボード詳細を取得する。React の cache() で同一リクエスト内の呼び出しをデデュープし、
// layout と各 page(d/[slug] / calendar 等)が同じ slug を引いても Hono 呼び出しは 1 回で済む。
// 失敗(404 等)も同じ結果が共有されるため、layout と page で判定がブレない。
export const getBoardDetail = cache(
  async (slug: string): Promise<BoardDetail | undefined> => {
    const caller = createCallerFactory(appRouter)({
      req: new Request("http://localhost"),
    });
    return (await caller.boards.getBySlug({ slug })).data;
  },
);
