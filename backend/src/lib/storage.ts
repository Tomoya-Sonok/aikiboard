// Supabase Storage(board-media バケット)の薄いヘルパ。
//
// バケットは非公開(migration 014)。アップロードは service_role 署名トークン経由、
// 表示は短命の署名付き DL URL 経由。これによりフロントは anon キーでもボード越境できない
// (パスは backend が生成し、署名 URL も backend が都度発行するため)。
//
// フィード(4.3)とアーカイブ(4.4)で共用する。パスの prefix(feed / archive)で用途を分ける。

import type { SupabaseClient } from "@supabase/supabase-js";
import { logger } from "./logger.js";

export const BOARD_MEDIA_BUCKET = "board-media";

// 添付の種別(board_post_attachments.attachment_type / archive_attachments.attachment_type)。
export type AttachmentKind = "image" | "video";

// アップロードを許可する MIME と拡張子の対応(migration 014 の allowed_mime_types と一致させる)。
const MIME_EXT: Record<string, { ext: string; kind: AttachmentKind }> = {
  "image/jpeg": { ext: "jpg", kind: "image" },
  "image/png": { ext: "png", kind: "image" },
  "image/webp": { ext: "webp", kind: "image" },
  "image/gif": { ext: "gif", kind: "image" },
  "video/mp4": { ext: "mp4", kind: "video" },
  "video/quicktime": { ext: "mov", kind: "video" },
  "video/webm": { ext: "webm", kind: "video" },
};

export const isAllowedContentType = (contentType: string): boolean =>
  contentType in MIME_EXT;

export const kindForContentType = (
  contentType: string,
): AttachmentKind | null => MIME_EXT[contentType]?.kind ?? null;

// 署名付きアップロード URL を作る。返すパスはボード配下に固定し、越境を防ぐ。
//   prefix: "feed" | "archive"
export type SignedUpload = {
  path: string;
  token: string;
  signedUrl: string;
  kind: AttachmentKind;
};

export const createSignedUpload = async (
  supabase: SupabaseClient,
  prefix: "feed" | "archive",
  boardId: string,
  contentType: string,
): Promise<SignedUpload | null> => {
  const meta = MIME_EXT[contentType];
  if (!meta) {
    return null;
  }
  // crypto.randomUUID は Workers / Node 18+ いずれでも利用可能。
  const path = `${prefix}/${boardId}/${crypto.randomUUID()}.${meta.ext}`;
  const { data, error } = await supabase.storage
    .from(BOARD_MEDIA_BUCKET)
    .createSignedUploadUrl(path);
  if (error || !data) {
    logger.error("署名付きアップロード URL の発行に失敗", {
      feature: "storage",
      boardId,
      error: error?.message,
    });
    return null;
  }
  return {
    path: data.path,
    token: data.token,
    signedUrl: data.signedUrl,
    kind: meta.kind,
  };
};

// パスがそのボード配下(prefix/<boardId>/...)かを検証する。create 時の越境防止。
export const isPathInBoard = (
  path: string,
  prefix: "feed" | "archive",
  boardId: string,
): boolean => path.startsWith(`${prefix}/${boardId}/`);

// 複数パスの署名付き DL URL を一括発行する。失敗したパスは Map に載らない。
export const resolveSignedUrls = async (
  supabase: SupabaseClient,
  paths: string[],
  expiresInSeconds = 3600,
): Promise<Map<string, string>> => {
  const result = new Map<string, string>();
  const uniquePaths = [...new Set(paths.filter((p) => p.length > 0))];
  if (uniquePaths.length === 0) {
    return result;
  }
  const { data, error } = await supabase.storage
    .from(BOARD_MEDIA_BUCKET)
    .createSignedUrls(uniquePaths, expiresInSeconds);
  if (error || !data) {
    logger.error("署名付き DL URL の発行に失敗", {
      feature: "storage",
      error: error?.message,
    });
    return result;
  }
  for (const item of data) {
    if (item.signedUrl && item.path) {
      result.set(item.path, item.signedUrl);
    }
  }
  return result;
};

// ベストエフォートでストレージ上のオブジェクトを削除する(投稿/ページ削除時)。
// 失敗してもログのみで握りつぶす(孤児ファイルは許容、後続でまとめて掃除可能)。
export const removeObjects = async (
  supabase: SupabaseClient,
  paths: string[],
): Promise<void> => {
  const targets = paths.filter((p) => p.length > 0);
  if (targets.length === 0) {
    return;
  }
  const { error } = await supabase.storage
    .from(BOARD_MEDIA_BUCKET)
    .remove(targets);
  if (error) {
    logger.warn("ストレージオブジェクトの削除に失敗(孤児ファイルとして残置)", {
      feature: "storage",
      error: error.message,
    });
  }
};
