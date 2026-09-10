# 通知(アプリ内)

## 概要

ボードスコープのアプリ内通知。お知らせ公開・稽古作成・フィード投稿・スレッド返信のイベントで受信者ごとに1行生成され、ヘッダーの通知ベルで確認・既読化できる。メール・プッシュ配信はない。

## ユーザーストーリー

- メンバーとして、ヘッダーのベルアイコンで未読件数をバッジ表示してほしい(99件超は"99+")(`frontend/src/components/features/notifications/NotificationBell/NotificationBell.tsx`)。
- メンバーとして、通知一覧を開いて未読(ドット表示)と既読を見分けたい(同上)。
- メンバーとして、通知をクリックすると既読になり、種類に応じて`announce`/`calendar`/`feed`セクションへ遷移してほしい(同上)。
- メンバーとして、「すべて既読」をまとめて実行したい(同上)。

## 機能要件

- ✅ 通知一覧(ボード+受信者スコープ、新しい順、`limit`/`offset`ページネーション)— `backend/src/routes/notifications/index.ts`
- ✅ 未読数取得(60秒ポーリング)— 同上, `NotificationBell.tsx`
- ✅ 1件既読(行は`recipient_user_id`で本人所有スコープ、board middleware不要)— 同上
- ✅ 全既読 — 同上
- ✅ 通知生成: `notifyBoardMembers`/`createNotifications`(ボード全メンバーへ、actor本人は除外、actor名・タイトルを`metadata`に非正規化)— `backend/src/lib/notifications.ts`
- ✅ 発火イベント: `announcement.published`([announcements](../announcements/spec.md)公開時)、`event.created`([events](../events/spec.md)作成時)、`post.created`/`thread.replied`([feed](../feed/spec.md)投稿・返信時、`backend/src/routes/board-posts/index.ts`で呼び出しをgrepで確認)
- ✅ 通知失敗は本処理を止めない(try/catchで握りつぶし、ログのみ)— `notifications.ts`
- ✅ RLS: 受信者本人のみSELECT/UPDATE/DELETE可、INSERTはservice_roleのみ — `015_create_notifications.sql`
- 🚧 `DELETE /api/notifications/:id`(`notifications.remove` tRPC procedure)はbackend・BFF両方に実装済みだが、`NotificationBell.tsx`にはこれを呼び出すUI操作(削除ボタン等)が無い。バックエンド止まりの機能
- ❓ `thread.replied`は投稿者本人のみへ通知する設計と要件メモに記載があるが、受信者解決ロジックの詳細は本調査範囲(`backend/src/routes/board-posts/*`)外のため未確認

## 画面・API・テーブルの対応

- 画面: ヘッダー常設の`NotificationBell`(専用ページなし。クリックで各機能画面へ遷移)
- API(`frontend/src/server/trpc/routers/notifications.ts`):
  - `notifications.list` ↔ `GET /api/notifications`
  - `notifications.unreadCount` ↔ `GET /api/notifications/unread-count`
  - `notifications.markRead` ↔ `PUT /api/notifications/:id/read`
  - `notifications.markAllRead` ↔ `POST /api/notifications/read-all`
  - `notifications.remove` ↔ `DELETE /api/notifications/:id`(UI未接続)
- テーブル: `aikiboard.notifications`

## 未決事項

- [TBD] `notifications.remove`(1件削除)がUIから使われていない理由(将来UI用の先行実装か)
- [TBD] `post.created`/`thread.replied`の受信者解決ロジックの詳細
- [TBD] プッシュ通知/PWA通知は対象外(roadmap.mdではR4-5として未着手扱い)

## この粒度で切った理由

専用マイグレーション(`015`)・専用tRPCルーター・受信者本人スコープという独立した認可軸(ボードメンバーシップではなく`recipient_user_id`)を持つため独立させた。[events](../events/spec.md)・[announcements](../announcements/spec.md)・[feed](../feed/spec.md)の書き込みイベントから発火される「受信側」機能だが、既読管理という責務は独立している。
