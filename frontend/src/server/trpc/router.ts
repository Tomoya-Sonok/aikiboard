// アプリ全体の tRPC ルーター。feature 別 sub router を merge する(ADR 0002 B-6)。

import { createTRPCRouter } from "./index";
import { usersRouter } from "./routers/users";

export const appRouter = createTRPCRouter({
  users: usersRouter,
});

export type AppRouter = typeof appRouter;
