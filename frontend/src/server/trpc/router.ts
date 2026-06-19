// アプリ全体の tRPC ルーター。feature 別 sub router を merge する(ADR 0002 B-6)。

import { createTRPCRouter } from "./index";
import { activityLogsRouter } from "./routers/activityLogs";
import { announcementsRouter } from "./routers/announcements";
import { archivesRouter } from "./routers/archives";
import { boardPostsRouter } from "./routers/boardPosts";
import { boardSettingsRouter } from "./routers/boardSettings";
import { boardsRouter } from "./routers/boards";
import { boardTodosRouter } from "./routers/boardTodos";
import { dojoMastersRouter } from "./routers/dojoMasters";
import { eventsRouter } from "./routers/events";
import { financeRouter } from "./routers/finance";
import { invitationsRouter } from "./routers/invitations";
import { membersRouter } from "./routers/members";
import { membershipRequestsRouter } from "./routers/membershipRequests";
import { notificationsRouter } from "./routers/notifications";
import { publicBoardsRouter } from "./routers/publicBoards";
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
  notifications: notificationsRouter,
  activityLogs: activityLogsRouter,
  boardSettings: boardSettingsRouter,
  publicBoards: publicBoardsRouter,
  archives: archivesRouter,
  finance: financeRouter,
  boardTodos: boardTodosRouter,
});

export type AppRouter = typeof appRouter;
