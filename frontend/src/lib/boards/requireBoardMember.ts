import { notFound } from "next/navigation";
import { getBoardDetail } from "@/lib/boards/getBoardDetail";
import { redirect } from "@/lib/i18n/routing";
import { getServerSupabase } from "@/lib/supabase/server";
import type { BoardDetail } from "@/lib/types/board";

// ボード配下のメンバー専用ページ用のガード。
//   - 未認証      → /login へ
//   - 非メンバー  → そのボードの公開ページ(/d/<slug>)へ(公開なら見られる)
//   - メンバー    → BoardDetail を返す
// `/d/<slug>` は (authenticated) グループ外に移したため、各メンバー専用ページはこれで自衛する。
export async function requireBoardMember(
  slug: string,
  locale: string,
): Promise<BoardDetail> {
  const supabase = await getServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect({ href: "/login", locale });
  }

  let board: BoardDetail | undefined;
  try {
    board = await getBoardDetail(slug);
  } catch {
    redirect({ href: "/login", locale });
  }
  if (!board) {
    notFound();
  }
  if (!board.viewerRole) {
    // 認証済みだが非メンバー → 公開ページへ。
    redirect({ href: `/d/${slug}`, locale });
  }
  return board;
}
