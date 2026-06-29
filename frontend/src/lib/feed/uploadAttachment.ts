// フィード投稿の添付アップロード。
//   1. backend に署名付きアップロード URL を要求(boardPosts.createUploadUrl)
//   2. ブラウザ Supabase クライアントで board-media バケットへ直接アップロード
//   3. 確定用の添付情報(path / 種別 / メタデータ)を返す → boardPosts.create で保存
//
// バケットは非公開。表示は backend が都度発行する署名付き DL URL を使うため、ここでは
// 公開 URL を組み立てない(path のみ保持する)。

import { getClientSupabase } from "@/lib/supabase/client";
import { trpcClient } from "@/lib/trpc/client";
import type { PostAttachmentInput } from "@/lib/types/post";

const BUCKET = "board-media";

// 1 ファイル分のサイズ上限(100MB)。migration 014 のバケット設定と揃える。
export const MAX_FILE_BYTES = 100 * 1024 * 1024;

export const ALLOWED_MIME = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "video/mp4",
  "video/quicktime",
  "video/webm",
]);

export const isAllowedFile = (file: File): boolean =>
  ALLOWED_MIME.has(file.type) && file.size <= MAX_FILE_BYTES;

export async function uploadAttachment(
  boardId: string,
  file: File,
): Promise<PostAttachmentInput> {
  const res = await trpcClient.boardPosts.createUploadUrl.mutate({
    boardId,
    contentType: file.type,
  });
  const data = res.data;
  if (!data) {
    throw new Error(res.error ?? "アップロード URL の取得に失敗しました");
  }

  const supabase = getClientSupabase();
  const { error } = await supabase.storage
    .from(BUCKET)
    .uploadToSignedUrl(data.path, data.token, file);
  if (error) {
    throw new Error(error.message);
  }

  return {
    path: data.path,
    attachmentType: data.attachmentType,
    metadata: {
      mime: file.type,
      name: file.name,
      sizeBytes: file.size,
    },
  };
}
