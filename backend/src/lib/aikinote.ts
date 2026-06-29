// AikiNote 連携(要件 5.3)。AikiNote のフィードは public."SocialPost"(本リポジトリ外、
// AikiNote 側が管理するテーブル)。AikiBoard は同一 Supabase プロジェクト内のリレーションで
// 引用共有・クロスポストを行う(外部 API コール不要、要件 5.3.3)。
//
// ⚠️ 重要: crossPostToAikinote は AikiNote の本番フィード(SocialPost)に行を挿入する。
//   ユーザーが投稿ごとにオプトインした場合のみ実行する(投稿フォームのチェックボックス)。
//
// SocialPost の主なカラム(aikinote backend migration 002 と一致):
//   id, user_id, content(≤2000), post_type('post'|'training_record'),
//   visibility('public'|'closed'|'private'), author_dojo_style_id, author_dojo_name,
//   is_deleted, created_at, updated_at

import type { SupabaseClient } from "@supabase/supabase-js";
import { logger } from "./logger.js";

// SocialPost.content の上限(aikinote 側 CHECK 制約)。
const AIKINOTE_CONTENT_MAX = 2000;

export type AikinotePostSummary = {
  id: string;
  content: string;
  postType: string;
  visibility: string;
  createdAt: string;
};

// 引用表示用の SocialPost(削除済みは content を伏せる)。
export type QuotedAikinotePost = {
  id: string;
  content: string;
  postType: string;
  authorName: string;
  createdAt: string;
  isDeleted: boolean;
};

// 自分の AikiNote 投稿一覧(引用ピッカー用)。新しい順。
//   5.3.2「投稿一覧に表示される投稿のみ引用可」の MVP 解釈として、まず本人の投稿に限定する。
export const listOwnAikinotePosts = async (
  supabase: SupabaseClient,
  userId: string,
  limit = 20,
): Promise<AikinotePostSummary[]> => {
  const { data, error } = await supabase
    .from("SocialPost")
    .select("id, content, post_type, visibility, created_at")
    .eq("user_id", userId)
    .eq("is_deleted", false)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) {
    logger.error("AikiNote 投稿の取得に失敗", {
      feature: "aikinote",
      userId,
      error: error.message,
    });
    return [];
  }
  return (data ?? []).map((r) => ({
    id: r.id as string,
    content: r.content as string,
    postType: r.post_type as string,
    visibility: r.visibility as string,
    createdAt: r.created_at as string,
  }));
};

// 指定 SocialPost が userId 本人のもの(かつ未削除)かを検証する(引用の所有検証)。
export const isOwnAikinotePost = async (
  supabase: SupabaseClient,
  postId: string,
  userId: string,
): Promise<boolean> => {
  const { data, error } = await supabase
    .from("SocialPost")
    .select("user_id, is_deleted")
    .eq("id", postId)
    .maybeSingle();
  if (error || !data) {
    return false;
  }
  return data.user_id === userId && data.is_deleted === false;
};

// synced_from_post_id 群 → 引用表示用 SocialPost を解決する(著者名つき)。
export const resolveQuotedPosts = async (
  supabase: SupabaseClient,
  postIds: string[],
): Promise<Map<string, QuotedAikinotePost>> => {
  const result = new Map<string, QuotedAikinotePost>();
  const ids = [...new Set(postIds.filter((p) => p))];
  if (ids.length === 0) {
    return result;
  }
  const { data, error } = await supabase
    .from("SocialPost")
    .select("id, user_id, content, post_type, is_deleted, created_at")
    .in("id", ids);
  if (error) {
    logger.error("引用 AikiNote 投稿の解決に失敗", {
      feature: "aikinote",
      error: error.message,
    });
    return result;
  }
  const rows = data ?? [];
  const authorIds = [...new Set(rows.map((r) => r.user_id as string))];
  const nameById = new Map<string, string>();
  if (authorIds.length > 0) {
    const { data: users } = await supabase
      .from("User")
      .select("id, username")
      .in("id", authorIds);
    for (const u of users ?? []) {
      nameById.set(u.id, u.username ?? "");
    }
  }
  for (const r of rows) {
    const isDeleted = r.is_deleted === true;
    result.set(r.id as string, {
      id: r.id as string,
      content: isDeleted ? "" : (r.content as string),
      postType: r.post_type as string,
      authorName: nameById.get(r.user_id as string) ?? "",
      createdAt: r.created_at as string,
      isDeleted,
    });
  }
  return result;
};

// AikiNote へのクロスポスト(SocialPost に 1 件挿入)。
//   content は SocialPost の上限(2000)に合わせて切り詰める。
//   visibility は public 固定(道場の公開フィードに流す想定)。
//   author_dojo_* はボードの主道場を充てる(道場アカウント経由の体裁)。
// 失敗は呼び出し側で握りつぶす(ボード投稿自体は止めない)。
export const crossPostToAikinote = async (
  supabase: SupabaseClient,
  params: {
    userId: string;
    content: string;
    dojoStyleId: string | null;
    dojoName: string | null;
  },
): Promise<{ id: string } | null> => {
  const content = params.content.slice(0, AIKINOTE_CONTENT_MAX);
  if (content.trim().length === 0) {
    return null;
  }
  const { data, error } = await supabase
    .from("SocialPost")
    .insert({
      user_id: params.userId,
      content,
      post_type: "post",
      visibility: "public",
      author_dojo_style_id: params.dojoStyleId,
      author_dojo_name: params.dojoName,
    })
    .select("id")
    .single();
  if (error || !data) {
    logger.error("AikiNote へのクロスポストに失敗", {
      feature: "aikinote",
      userId: params.userId,
      error: error?.message,
    });
    return null;
  }
  logger.info("AikiNote へクロスポストした", {
    feature: "aikinote",
    userId: params.userId,
    socialPostId: data.id,
  });
  return { id: data.id as string };
};
