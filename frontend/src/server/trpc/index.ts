// tRPC 初期化。ADR 0002 B-5 / B-6。
// authenticatedProcedure は Supabase session を getUser() で検証し、
// access_token を ctx に載せて Hono backend へ Bearer 転送する。
// AikiNote の自前 JWT 生成(generateToken / jwt.sign)は採用しない。

import { initTRPC, TRPCError } from "@trpc/server";
import { getServerSupabase } from "@/lib/supabase/server";

export type TRPCContext = {
  req: Request;
};

const t = initTRPC.context<TRPCContext>().create({
  errorFormatter({ shape }) {
    return shape;
  },
});

export const createTRPCRouter = t.router;
export const createCallerFactory = t.createCallerFactory;
export const publicProcedure = t.procedure;

export const authenticatedProcedure = t.procedure.use(async ({ next }) => {
  const supabase = await getServerSupabase();

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: "認証が必要です" });
  }

  const {
    data: { session },
  } = await supabase.auth.getSession();
  const accessToken = session?.access_token;
  if (!accessToken) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "認証トークンを取得できませんでした",
    });
  }

  return next({
    ctx: { accessToken, userId: user.id },
  });
});
