// ボードホームのダッシュボード本体。シェル(サイドバー/ヘッダー)とメンバーガードは
// layout.tsx が提供する。カードは今はダミー表示で、各機能 PR で実データに差し替える。

import { DashboardCards } from "@/components/features/boards/dashboard/DashboardCards";

export default function BoardHomePage() {
  return <DashboardCards />;
}
