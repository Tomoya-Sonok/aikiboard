// dojoMasters feature router。ボード作成フォームの道場選択(検索)で使う。

import { z } from "zod";
import type { ApiResponse } from "@/lib/types/api";
import { callHonoApi } from "../hono";
import { authenticatedProcedure, createTRPCRouter } from "../index";

type DojoMaster = {
  id: string;
  dojo_name: string;
  dojo_name_kana: string | null;
};

export const dojoMastersRouter = createTRPCRouter({
  // 承認済み道場を名称/かなで部分一致検索。
  search: authenticatedProcedure
    .input(
      z.object({
        q: z.string().max(100).optional(),
        limit: z.number().int().min(1).max(50).optional(),
      }),
    )
    .query(async ({ input, ctx }) => {
      const params = new URLSearchParams();
      if (input.q) {
        params.set("q", input.q);
      }
      if (input.limit) {
        params.set("limit", String(input.limit));
      }
      const queryString = params.toString();
      return callHonoApi<ApiResponse<DojoMaster[]>>(
        `/api/dojo-masters${queryString ? `?${queryString}` : ""}`,
        {
          method: "GET",
          headers: { Authorization: `Bearer ${ctx.accessToken}` },
        },
      );
    }),
});
