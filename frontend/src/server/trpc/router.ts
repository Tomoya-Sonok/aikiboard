// アプリ全体の tRPC ルーター。feature 別 sub router を merge する(ADR 0002 B-6)。

import { createTRPCRouter } from "./index";
import { announcementsRouter } from "./routers/announcements";
import { boardPostsRouter } from "./routers/boardPosts";
import { boardsRouter } from "./routers/boards";
import { dojoMastersRouter } from "./routers/dojoMasters";
import { eventsRouter } from "./routers/events";
import { invitationsRouter } from "./routers/invitations";
import { membersRouter } from "./routers/members";
import { membershipRequestsRouter } from "./routers/membershipRequests";
import { usersRouter } from "./routers/users";

export const appRouter = createTRPCRouter({
  users: usersRouter,
  boards: boardsRouter,
  dojoMasters: dojoMastersRouter,
  events: eventsRouter,
  announcements: announcementsRouter,
  boardPosts: boardPostsRouter,
  members: membersRouter,
  invitations: invitationsRouter,
  membershipRequests: membershipRequestsRouter,
});

export type AppRouter = typeof appRouter;
