// dojoMasters feature router。ボード作成フォームの道場選択(検索)で使う。

import { z } from "zod";
import type { ApiResponse } from "@/lib/types/api";
import { callHonoApi } from "../hono";
import { authenticatedProcedure, createTRPCRouter } from "../index";

type DojoMaster = {
  id: string;
  dojo_name: string;
  dojo_name_kana: string | null;
  is_approved: boolean;
};

// 新規追加の戻り(既存と一致したら existed=true)。
type CreatedDojoMaster = DojoMaster & { existed: boolean };

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

  // 新規道場を追加(双方向書き込み、要件 5.2)。既存一致なら既存を返す。
  create: authenticatedProcedure
    .input(
      z.object({
        dojoName: z.string().trim().min(1).max(100),
        dojoNameKana: z.string().trim().max(100).optional(),
        region: z.string().trim().max(100).optional(),
      }),
    )
    .mutation(({ input, ctx }) =>
      callHonoApi<ApiResponse<CreatedDojoMaster>>("/api/dojo-masters", {
        method: "POST",
        headers: { Authorization: `Bearer ${ctx.accessToken}` },
        body: JSON.stringify(input),
      }),
    ),
});
