// アーカイブの添付アップロード(フィードと同方式、prefix "archive")。
//   1. archives.createUploadUrl で署名付きアップロード URL を取得
//   2. board-media バケットへ直接アップロード
//   3. 確定用の添付情報を返す → archives.create / update で保存

import { getClientSupabase } from "@/lib/supabase/client";
import { trpcClient } from "@/lib/trpc/client";
import type { ArchiveAttachmentInput } from "@/lib/types/archive";

const BUCKET = "board-media";

export async function uploadArchiveAttachment(
  boardId: string,
  file: File,
): Promise<ArchiveAttachmentInput> {
  const res = await trpcClient.archives.createUploadUrl.mutate({
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
    metadata: { mime: file.type, name: file.name, sizeBytes: file.size },
  };
}
