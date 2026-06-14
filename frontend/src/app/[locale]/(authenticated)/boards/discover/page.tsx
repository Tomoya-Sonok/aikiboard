// 道場ボードの発見・参加申請ページ。自分の AikiNote 道場に紐づくボードを探して申請する。
// ボード配下ではない(まだメンバーでない)ため、認証のみ必須(d/[slug] のガード外)。

import { DiscoverBoardsView } from "@/components/features/members/DiscoverBoardsView/DiscoverBoardsView";

export default function BoardsDiscoverPage() {
  return <DiscoverBoardsView />;
}
