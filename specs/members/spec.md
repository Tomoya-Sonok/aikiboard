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
- ✅ **ロール変更(アドミン任命・解除)**: `member ⇄ admin` の昇降格(PR #115 で実装、下記「ロール変更の仕様」参照)— `backend/src/routes/members/index.ts` の `PATCH /:userId/role`

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

## ロール変更の仕様

`docs/prd/dojo-platform-vision.md` で確定したスコープ(2026-09-10)。製品概要3.4「アドミン権限を持つ幹部や事務局メンバーに、オーナー代理で管理操作を任せる運用ができます」を成立させるための機能。

### ユーザーストーリー

- オーナー・アドミンとして、招待で参加したメンバーをアドミンに昇格させ、運営業務(お知らせ作成・メンバー承認・Todo管理等)を任せたい。
- オーナー・アドミンとして、役割を離れたアドミンをメンバーに戻したい。
- 昇格・降格された本人として、自分の権限が変わったことを通知で知りたい。

### 機能要件

- 対象の遷移は `member → admin`(昇格)と `admin → member`(降格)の2つのみ。owner が絡む遷移(`owner → admin`、`member → owner` 等)は400で拒否する。オーナー譲渡は本スコープ外。
- 実行権限は **owner / admin**。member が実行した場合は403。非メンバーは404(存在を隠す。`docs/constitution.md` 原則2)。
- **自分自身のロール変更は不可**(400)。既存のメンバー削除が「自分自身は不可」としているパターンに揃える。降りたい admin は自主退会するか、他の owner/admin に降格してもらう。
- 変更が実際に発生しない場合(現在の role と同じ値を指定)は400。
- 操作履歴(`activity_logs`)に `member.role_changed` として記録する(`backend/src/lib/activity.ts` の `ActivityAction` に追加)。
- 対象ユーザー本人にのみアプリ内通知を送る(`backend/src/lib/notifications.ts` の `createNotifications` を単一宛先で使用。`notifyBoardMembers` は使わない)。
- フロントエンドは `MembersView` の各行に、owner/admin にのみ見えるロール変更ボタン(「管理者にする」/「管理者を解除」)を表示する。確認は既存のメンバー削除・退会と同じ `window.confirm` を使う(同画面内の操作の一貫性を優先。ボード削除はボード名の入力が必要なため共通 `Dialog` を使うが、こちらは入力が不要)。

### 受け入れ条件

- owner が member を admin に昇格させると、その人に admin 限定のナビ(Todo・アクティビティログ等)と管理操作が現れる。
- admin が別の member を admin に昇格できる(今回の決定により admin にも実行権限がある)。
- member はロール変更メニュー自体が見えず、API を直接叩いても403になる。
- owner を対象にしたロール変更は、誰が実行しても400で拒否される。
- ロール変更が `activity_logs` に記録され、アクティビティログ画面に「◯◯さんを管理者にしました」等として表示される。
- 対象本人に通知が届く。

## 画面・API・テーブルの対応

- 画面: `frontend/src/app/[locale]/d/[slug]/members/page.tsx`(`MembersView`)、`frontend/src/app/[locale]/(authenticated)/invite/[token]/page.tsx`(`InviteJoin`)、`InviteLinkPanel`, `PendingRequestsPanel`
- API(tRPC): `invitations.{list,create,revoke,preview,join}`, `members.{list,remove,leave,changeRole}`, `membershipRequests.{listForBoard,create,approve,reject}`(discoverable/mineは未公開)
- API(Hono): ロール変更は `PATCH /api/members/:userId/role`(body: `{boardId, role}`)
- テーブル: `aikiboard.boards`, `aikiboard.board_members`(owner一意インデックス`idx_board_members_one_owner`)、`aikiboard.invitations`、`aikiboard.membership_requests`、`aikiboard.board_dojo_masters`(申請の道場紐付け判定に使用)

## 未決事項

- [TBD] owner権限の「引き継ぎ」機能(オーナー交代)がUI/APIとも見当たらない。退会不可メッセージのみ存在し、実現手段は不明(今回のロール変更は `member ⇄ admin` のみで、オーナー譲渡は対象外)
- [Clarified: 2026-09-10] member⇄adminの昇降格は「ロール変更の仕様」節として確定済み(`docs/prd/dojo-platform-vision.md`)
- [TBD] AikiBoard側での「参加申請の発見・送信(discoverable/mine/create)」UIは存在しない。AikiNote側に実装される想定とコメントにあるが、確認は本リポジトリの範囲外
- [TBD] 招待リンクの「QRコード」表示の有無(コメントに言及はあるが、QR生成コードは未発見)

## この粒度で切った理由

独立したHonoルート(`invitations`/`members`/`membership-requests`)・専用DBテーブル群・専用フロントエンドディレクトリを持ち、コード上の境界が明確に分離されている。認可ロジック(boardAccessミドルウェア)という横断的関心事を機能内で完結して記述できるため、この単位で切った。
