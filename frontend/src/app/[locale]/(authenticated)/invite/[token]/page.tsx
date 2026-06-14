// 招待リンクの参加ページ。ボード配下ではない(まだメンバーでないため)が、認証は必須
// (d/[slug] のメンバーガードは通さない)。token のプレビュー → 参加は client 側で行う。

import { InviteJoin } from "@/components/features/members/InviteJoin/InviteJoin";

export default async function InvitePage({
  params,
}: {
  params: Promise<{ locale: string; token: string }>;
}) {
  const { token } = await params;
  return <InviteJoin token={token} />;
}
