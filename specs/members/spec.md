# メンバー管理・招待・参加申請

## 概要

ボード(道場)へのメンバー参加経路として「共有招待リンク(マルチユース)」と「AikiNote道場紐付けによる参加申請」の2系統を持ち、owner/adminがメンバー一覧・削除・承認/却下を管理する。ロールはowner/admin/memberの3種で、ownerはボードに1名のみ。

## ユーザーストーリー

- 管理者として、招待リンクを発行してメンバーを増やしたい(`frontend/src/components/features/members/InviteLinkPanel/InviteLinkPanel.tsx`: 発行ボタン・URL表示・コピー・失効ボタン)。
- 招待された非会員として、リンクを開くとボード名・メンバー数のプレビューを見て「参加する」ボタンで参加できる(`InviteJoin.tsx`)。
- 管理者として、AikiNote道場に所属する未参加者からの参加申請を承認/却下したい(`PendingRequestsPanel.tsx`)。
- メンバーとして、メンバー一覧で参加日・ロールバッジを確認し、自分は退会、管理者は他メンバー(owner以外)を削除できる(`MembersView.tsx`)。
- ownerは退会・削除の対象にならない(バリデーションメッセージ「オーナーは退会できません。先に権限を引き継いでください」)— ただし「権限引き継ぎ」機能自体はコード上に存在しない。

## 機能要件

- ✅ 共有招待リンク発行(有効期限1〜365日、デフォルト30日、任意ラベル)— `backend/src/routes/invitations/index.ts`
- ✅ 招待リンク一覧(失効・期限切れ除外)— 同上
- ✅ 招待リンク失効(soft revoke)— 同上、`012_invitations_multi_use.sql`
- ✅ 招待トークンでのプレビュー(ボード名・メンバー数・既参加判定)— 同上、`InviteJoin.tsx`
- ✅ 招待トークンでの参加(常に role="member"付与、冪等)— 同上
- 🚧 AikiNote道場紐付けボードの発見(discoverable): backend実装済みだが、AikiBoardのフロントエンドtRPCルータには公開されていない(「AikiNote側に導線を設ける方針」とコメント明記)。AikiBoard側では未使用
- 🚧 自分の申請状態確認(mine): 同上、backendのみ存在
- 🚧 参加申請の送信(create): backend実装済み(道場紐付け・重複申請チェックあり)だが、AikiBoard側フロントに呼び出し元UIコンポーネントが見当たらない
- ✅ 参加申請の承認/却下(owner/admin)— `backend/src/routes/membership-requests/index.ts`, `PendingRequestsPanel.tsx`
- ✅ メンバー一覧取得(owner→admin→member順、参加日昇順)— `backend/src/routes/members/index.ts`
- ✅ メンバー削除(owner/adminのみ、owner対象は不可、自分自身は不可)— 同上
- ✅ 自主退会(owner不可)— 同上
- ✅ 削除/退会時の関連データ掃除(event_rsvps, announcement_reads)— 同上
- ✅ 操作履歴記録(member.joined/left/removed)— `logActivity`呼び出し各所
- ❓ ロール変更(member→adminへの昇格、admin降格など)は該当API・UIが一切見つからない。ownerはボード作成時に1回だけ付与、他は常に"member"固定で付与。**ロール管理機能(昇格/降格)は実質未実装**

## ロール権限チェックの実装(重点)

`backend/src/middleware/boardAccess.ts`に集約されたミドルウェア方式。
- `authMiddleware`がJWTを検証し`c.set("userId", ...)`。
- `createBoardGuard(level, idTable)`がボードID解決(優先順: ルートパラメータ`:id`→対象テーブルのboard_id / query`boardId` / body`boardId`)→`board_members`を service_role で参照し役割を取得。
  - `level:"member"` → owner/admin/memberいずれでも許可。
  - `level:"admin"` → owner/adminのみ許可、それ以外は403。
  - 非メンバーは404(存在を伏せる)。
- 招待/参加申請専用の派生ミドルウェア: `invitationAdminMiddleware`, `membershipRequestAdminMiddleware`。
- ルートハンドラ内でも個別に`boardRole==="owner"`チェック(退会時のowner保護、削除対象がownerかのチェック)。
- backendはservice_roleでRLSをバイパスするため、boardAccessミドルウェアが唯一の砦(コード内コメントで明言)。RLSはフロントがanonキーで直接読む経路の二重防御。

## 画面・API・テーブルの対応

- 画面: `frontend/src/app/[locale]/d/[slug]/members/page.tsx`(`MembersView`)、`frontend/src/app/[locale]/(authenticated)/invite/[token]/page.tsx`(`InviteJoin`)、`InviteLinkPanel`, `PendingRequestsPanel`
- API(tRPC): `invitations.{list,create,revoke,preview,join}`, `members.{list,remove,leave}`, `membershipRequests.{listForBoard,create,approve,reject}`(discoverable/mineは未公開)
- テーブル: `aikiboard.boards`, `aikiboard.board_members`(owner一意インデックス`idx_board_members_one_owner`)、`aikiboard.invitations`、`aikiboard.membership_requests`、`aikiboard.board_dojo_masters`(申請の道場紐付け判定に使用)

## 未決事項

- [TBD] owner権限の「引き継ぎ」機能(オーナー交代)がUI/APIとも見当たらない。退会不可メッセージのみ存在し、実現手段は不明
- [TBD] member→adminへの昇格、admin→memberへの降格機能。少なくとも専用API/UIは存在しない(要件定義書3.2の権限マトリクスとの乖離、[boards](../boards/spec.md)の未決事項とも重複)
- [TBD] AikiBoard側での「参加申請の発見・送信(discoverable/mine/create)」UIは存在しない。AikiNote側に実装される想定とコメントにあるが、確認は本リポジトリの範囲外
- [TBD] 招待リンクの「QRコード」表示の有無(コメントに言及はあるが、QR生成コードは未発見)

## この粒度で切った理由

独立したHonoルート(`invitations`/`members`/`membership-requests`)・専用DBテーブル群・専用フロントエンドディレクトリを持ち、コード上の境界が明確に分離されている。認可ロジック(boardAccessミドルウェア)という横断的関心事を機能内で完結して記述できるため、この単位で切った。
