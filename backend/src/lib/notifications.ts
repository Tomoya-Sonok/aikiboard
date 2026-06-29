// アプリ内通知(要件 4.9)の生成ヘルパ。
//
// 各機能のルート(お知らせ公開・フィード投稿・スレッド返信・稽古作成)から呼ぶ。
// 通知の失敗は本処理(投稿・公開等)を止めない設計のため、呼び出し側は try/catch で包むか、
// このモジュールの関数自体が例外を握りつぶす(下記)。
//
// 表示用の actor 名・タイトルは metadata に非正規化して保存する(一覧取得の JOIN 回避)。

import type { SupabaseClient } from "@supabase/supabase-js";
import { logger } from "./logger.js";

export type NotificationType =
  | "announcement.published"
  | "post.created"
  | "thread.replied"
  | "event.created";

type CreateParams = {
  boardId: string;
  recipientUserIds: string[];
  actorUserId: string | null;
  type: NotificationType;
  targetType: string;
  targetId: string;
  // 一覧表示用の短いタイトル/抜粋(metadata に格納)。
  title: string;
};

const TITLE_MAX = 120;

// actor の表示名を解決する(metadata に焼き込む)。
const resolveActorName = async (
  supabase: SupabaseClient,
  actorUserId: string | null,
): Promise<string> => {
  if (!actorUserId) {
    return "";
  }
  const { data } = await supabase
    .from("User")
    .select("username")
    .eq("id", actorUserId)
    .maybeSingle();
  return (data?.username as string | undefined) ?? "";
};

// 受信者ごとに 1 行作る。actor 自身は除外し、重複も排除する。
// 失敗してもログのみ(本処理を止めない)。
export const createNotifications = async (
  supabase: SupabaseClient,
  params: CreateParams,
): Promise<void> => {
  try {
    const recipients = [
      ...new Set(
        params.recipientUserIds.filter((id) => id && id !== params.actorUserId),
      ),
    ];
    if (recipients.length === 0) {
      return;
    }
    const actorName = await resolveActorName(supabase, params.actorUserId);
    const title = params.title.slice(0, TITLE_MAX);
    const rows = recipients.map((recipientUserId) => ({
      board_id: params.boardId,
      recipient_user_id: recipientUserId,
      actor_user_id: params.actorUserId,
      type: params.type,
      target_type: params.targetType,
      target_id: params.targetId,
      metadata: { actorName, title },
    }));
    const { error } = await supabase
      .schema("aikiboard")
      .from("notifications")
      .insert(rows);
    if (error) {
      logger.error("通知の作成に失敗", {
        feature: "notifications",
        boardId: params.boardId,
        type: params.type,
        error: error.message,
      });
    }
  } catch (error) {
    logger.error("通知の作成で予期しない例外", {
      feature: "notifications",
      type: params.type,
      error: error instanceof Error ? error.message : String(error),
    });
  }
};

// ボードの全メンバー(actor 除く)に通知する(お知らせ・フィード投稿・稽古作成)。
// 通知は本処理を止めない方針のため、全体を try/catch で握りつぶす(失敗はログのみ)。
export const notifyBoardMembers = async (
  supabase: SupabaseClient,
  params: Omit<CreateParams, "recipientUserIds">,
): Promise<void> => {
  try {
    const { data, error } = await supabase
      .schema("aikiboard")
      .from("board_members")
      .select("user_id")
      .eq("board_id", params.boardId);
    if (error || !Array.isArray(data)) {
      if (error) {
        logger.error("通知先メンバーの取得に失敗", {
          feature: "notifications",
          boardId: params.boardId,
        });
      }
      return;
    }
    await createNotifications(supabase, {
      ...params,
      recipientUserIds: data.map((m) => m.user_id as string),
    });
  } catch (error) {
    logger.error("通知(notifyBoardMembers)で予期しない例外", {
      feature: "notifications",
      boardId: params.boardId,
      error: error instanceof Error ? error.message : String(error),
    });
  }
};
