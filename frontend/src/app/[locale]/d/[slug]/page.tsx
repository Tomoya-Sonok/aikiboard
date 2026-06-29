// ボードホーム。同じ URL `/d/<slug>` を認証状態で出し分ける:
//   - メンバー   → ダッシュボード(会員向け。シェルは layout が提供)
//   - 非メンバー / 未認証 → 公開ページ(is_public のとき)。非公開なら login / home へ。

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { DashboardCards } from "@/components/features/boards/dashboard/DashboardCards";
import { PublicBoardView } from "@/components/features/public/PublicBoardView/PublicBoardView";
import { getBoardDetail } from "@/lib/boards/getBoardDetail";
import { getPublicBoard } from "@/lib/boards/getPublicBoard";
import { redirect } from "@/lib/i18n/routing";
import { getServerSupabase } from "@/lib/supabase/server";
import type { BoardDetail } from "@/lib/types/board";

// SEO: 公開ボードはプロフィールからタイトル/説明を生成する(4.7)。
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const board = await getPublicBoard(slug);
  if (!board) {
    return { title: "AikiBoard" };
  }
  const description =
    board.description ??
    `${board.name} の道場ページ。稽古スケジュールやお問い合わせはこちら。`;
  return {
    title: `${board.name} | AikiBoard`,
    description,
    openGraph: {
      title: `${board.name} | AikiBoard`,
      description,
      type: "website",
    },
  };
}

export default async function BoardHomePage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;

  const supabase = await getServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // ログイン済みメンバーはダッシュボード。
  if (user) {
    let board: BoardDetail | undefined;
    try {
      board = await getBoardDetail(slug);
    } catch {
      board = undefined;
    }
    if (board?.isMember) {
      return <DashboardCards boardId={board.id} slug={board.slug} />;
    }
  }

  // それ以外は公開ページ(公開ボードのみ)。
  const publicBoard = await getPublicBoard(slug);
  if (!publicBoard) {
    // 非公開 / 存在しない: 認証済みなら所属解決へ、未認証はログインへ。
    if (user) {
      redirect({ href: "/home", locale });
    }
    redirect({ href: "/login", locale });
    notFound();
  }

  return <PublicBoardView board={publicBoard} />;
}
