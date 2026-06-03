// users feature router(ADR 0002 B-6: feature 別分割)。
// tRPC procedure ↔ Hono endpoint は 1:1。

import { z } from "zod";
import type { ApiResponse } from "@/lib/types/api";
import { callHonoApi } from "../hono";
import {
  authenticatedProcedure,
  createTRPCRouter,
  publicProcedure,
} from "../index";

type CreatedUser = {
  id: string;
  email: string;
  username: string;
};

type UserProfile = {
  id: string;
  email: string | null;
  username: string;
  profile_image_url: string | null;
};

export const usersRouter = createTRPCRouter({
  // サインアップ(認証前なので publicProcedure)。
  create: publicProcedure
    .input(
      z.object({
        email: z.email(),
        password: z.string().min(8),
        username: z.string().min(1).max(20),
      }),
    )
    .mutation(async ({ input }) => {
      return callHonoApi<ApiResponse<CreatedUser>>("/api/users", {
        method: "POST",
        body: JSON.stringify(input),
      });
    }),

  // 本人の profile 取得(認証必須)。
  getUserInfo: authenticatedProcedure
    .input(z.object({ userId: z.string().min(1) }))
    .query(async ({ input, ctx }) => {
      return callHonoApi<ApiResponse<UserProfile>>(
        `/api/users/${input.userId}`,
        {
          method: "GET",
          headers: { Authorization: `Bearer ${ctx.accessToken}` },
        },
      );
    }),
});
