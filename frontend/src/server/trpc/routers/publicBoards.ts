// 公開ページ feature router(ADR 0002 B-6)。**publicProcedure(認証不要)**。
// 未認証ユーザーも叩けるよう Authorization ヘッダーを付けない。

import { z } from "zod";
import type { ApiResponse } from "@/lib/types/api";
import type {
  PublicBoard,
  PublicEventOccurrence,
} from "@/lib/types/publicBoard";
import { callHonoApi } from "../hono";
import { createTRPCRouter, publicProcedure } from "../index";

const slugInput = z.string().min(1).max(120);

export const publicBoardsRouter = createTRPCRouter({
  // 公開ボードのプロフィール(anon)。
  board: publicProcedure
    .input(z.object({ slug: slugInput }))
    .query(({ input }) =>
      callHonoApi<ApiResponse<PublicBoard>>(
        `/api/public/boards/${encodeURIComponent(input.slug)}`,
      ),
    ),

  // 公開カレンダー(anon)。
  events: publicProcedure
    .input(z.object({ slug: slugInput, from: z.string(), to: z.string() }))
    .query(({ input }) => {
      const qs = new URLSearchParams({ from: input.from, to: input.to });
      return callHonoApi<ApiResponse<PublicEventOccurrence[]>>(
        `/api/public/boards/${encodeURIComponent(input.slug)}/events?${qs.toString()}`,
      );
    }),
});
