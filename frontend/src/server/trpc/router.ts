// アプリ全体の tRPC ルーター。feature 別 sub router を merge する(ADR 0002 B-6)。

import { createTRPCRouter } from "./index";
import { boardsRouter } from "./routers/boards";
import { dojoMastersRouter } from "./routers/dojoMasters";
import { usersRouter } from "./routers/users";

export const appRouter = createTRPCRouter({
  users: usersRouter,
  boards: boardsRouter,
  dojoMasters: dojoMastersRouter,
});

export type AppRouter = typeof appRouter;
