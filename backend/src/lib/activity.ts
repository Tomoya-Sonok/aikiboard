// アクティビティログ(操作履歴、要件 4.6)。管理者向け。有料機能(activity_log)。
//
// 各機能のルート(稽古・お知らせ・フィード・メンバー等)から logActivity を呼んで
// activity_logs に 1 行追加する。表示用の actor 名は metadata に非正規化する(一覧の JOIN 回避)。
// 失敗してもログのみ(本処理を止めない)。書き込みは service_role 経由(RLS は閲覧のみ admin)。

import type { SupabaseClient } from "@supabase/supabase-js";
import { logger } from "./logger.js";

export type ActivityAction =
  | "event.created"
  | "event.updated"
  | "event.deleted"
  | "announcement.published"
  | "post.created"
  | "rsvp.responded"
  | "member.joined"
  | "member.left"
  | "member.removed";

type LogParams = {
  boardId: string;
  userId: string | null; // 行動者
  action: ActivityAction;
  targetType?: string;
  targetId?: string | null;
  // 一覧表示用の短いタイトル/補足(metadata.title)。
  title?: string;
  // 追加の metadata(任意)。
  extra?: Record<string, unknown>;
};

const TITLE_MAX = 120;

const resolveActorName = async (
  supabase: SupabaseClient,
  userId: string | null,
): Promise<string> => {
  if (!userId) {
    return "";
  }
  const { data } = await supabase
    .from("User")
    .select("username")
    .eq("id", userId)
    .maybeSingle();
  return (data?.username as string | undefined) ?? "";
};

export const logActivity = async (
  supabase: SupabaseClient,
  params: LogParams,
): Promise<void> => {
  try {
    const actorName = await resolveActorName(supabase, params.userId);
    const metadata: Record<string, unknown> = {
      actorName,
      title: (params.title ?? "").slice(0, TITLE_MAX),
      ...(params.extra ?? {}),
    };
    const { error } = await supabase
      .schema("aikiboard")
      .from("activity_logs")
      .insert({
        board_id: params.boardId,
        user_id: params.userId,
        action: params.action,
        target_type: params.targetType ?? null,
        target_id: params.targetId ?? null,
        metadata,
      });
    if (error) {
      logger.error("アクティビティログの記録に失敗", {
        feature: "activity",
        boardId: params.boardId,
        action: params.action,
        error: error.message,
      });
    }
  } catch (error) {
    logger.error("アクティビティログで予期しない例外", {
      feature: "activity",
      action: params.action,
      error: error instanceof Error ? error.message : String(error),
    });
  }
};
