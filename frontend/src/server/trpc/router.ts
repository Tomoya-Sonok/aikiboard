// アプリ全体の tRPC ルーター。feature 別 sub router を merge する(ADR 0002 B-6)。

import { createTRPCRouter } from "./index";
import { announcementsRouter } from "./routers/announcements";
import { boardsRouter } from "./routers/boards";
import { dojoMastersRouter } from "./routers/dojoMasters";
import { eventsRouter } from "./routers/events";
import { usersRouter } from "./routers/users";

export const appRouter = createTRPCRouter({
  users: usersRouter,
  boards: boardsRouter,
  dojoMasters: dojoMastersRouter,
  events: eventsRouter,
  announcements: announcementsRouter,
});

export type AppRouter = typeof appRouter;
