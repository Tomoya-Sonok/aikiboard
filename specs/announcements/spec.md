# お知らせ配信

## 概要

管理者(owner/admin)からメンバーへの一方向配信機能。作成は常に下書きとして保存し、別操作で公開する2段階フロー。リッチテキスト本文、既読管理、公開時のメール通知オプションを持つ。

## ユーザーストーリー

- 管理者として、タイトル(1〜200字)とリッチテキスト本文を入力し、下書き保存または公開したい(`frontend/src/components/features/announcements/AnnouncementForm/AnnouncementForm.tsx`)。
- 管理者として、「メールでも通知する」をチェックして公開すると確認ダイアログの文言が変わり(`publishConfirmEmail`)、公開時にメンバー全員へメールが届くようにしたい(`AnnouncementForm.tsx`, `backend/src/lib/announcement-email.ts`)。
- 管理者として、公開済みのお知らせも編集できるが、その場合は「保存」のみで公開ボタンは出ず、メール再通知はされないことをヒント文言で知りたい(`AnnouncementForm.tsx`)。
- メンバーとして、一覧で下書き/未読/既読をドットの色で見分けたい(`AnnouncementsView.tsx`)。
- メンバーとして、下書きのお知らせは一覧にも詳細にも表示されない(存在ごと伏せられる)(`backend/src/routes/announcements/index.ts`)。
- メンバーとして、お知らせを開いたら自動的に既読になってほしい(`AnnouncementDetailModal.tsx`)。

## 機能要件

- ✅ 作成は常に下書き(`published_at = NULL`)— `backend/src/routes/announcements/index.ts`
- ✅ 公開は`published_at`セットの一方向操作(既に公開済みなら400)— 同上
- ✅ 編集(公開済みでも可、再メールなし)— 同上
- ✅ 削除(readsはCASCADEで削除)— 同上
- ✅ 一覧: memberは公開済みのみ、adminは下書きも先頭表示(`published_at` nullsFirst)— 同上
- ✅ 未読数取得(公開済みのうち自分の既読行が無いものの件数)— 同上
- ✅ 既読登録(冪等、下書きは400)— 同上
- ✅ 本文はProseMirror(Tiptap)JSONで、backendのzodホワイトリストが構造を厳格検証(`doc/paragraph/heading[1-3]/text/hardBreak`+`bold/link[http(s)限定]`+`textAlign`)— `backend/src/lib/richtext.ts`
- ✅ `notify_email=true`で公開時にResend batch APIで宛先ごとに1通ずつ(相互漏洩防止)、`waitUntil`のfire-and-forgetでメール送信 — `announcement-email.ts`, `announcements/index.ts`
- ✅ 公開時にボードメンバー全員(投稿者除く)へアプリ内通知+操作履歴を記録 — `announcements/index.ts`
- ✅ RLS: 下書きは「メンバーかつ(公開済みORadmin)」に限定。既読INSERTも「公開済み+メンバー」に限定 — `011_announcements_draft_rls.sql`
- ❓ メール送信失敗時、管理者にフィードバックする手段がコード上見当たらない(ログのみ、UIには一切表れない)
- ❓ 一覧の抜粋文字数`EXCERPT_MAX=120`の選定根拠は不明

## 画面・API・テーブルの対応

- 画面: `frontend/src/app/[locale]/d/[slug]/announce/page.tsx` → `AnnouncementsView` → `AnnouncementForm` / `AnnouncementDetailModal`
- API(`frontend/src/server/trpc/routers/announcements.ts`):
  - `announcements.list` ↔ `GET /api/announcements`
  - `announcements.unreadCount` ↔ `GET /api/announcements/unread-count`
  - `announcements.detail` ↔ `GET /api/announcements/:id`
  - `announcements.create` ↔ `POST /api/announcements`
  - `announcements.update` ↔ `PATCH /api/announcements/:id`
  - `announcements.publish` ↔ `POST /api/announcements/:id/publish`
  - `announcements.remove` ↔ `DELETE /api/announcements/:id`
  - `announcements.markRead` ↔ `PUT /api/announcements/:id/read`
- テーブル: `aikiboard.announcements`, `aikiboard.announcement_reads`

## 未決事項

- [TBD] メール送信失敗の可観測性(管理者向け通知)
- [TBD] 公開済み編集時に本文を大きく変更した場合でも一切再通知しない仕様の妥当性(要件文書にも詳細規定なし)

## この粒度で切った理由

専用マイグレーション(`004`/`011`)・専用権限ミドルウェア(`announcementAdminMiddleware`系)・専用tRPCルーター・専用ナビゲーション画面を持つ独立機能。公開時に[notifications](../notifications/spec.md)へイベントを発火する関係にあるが、配信内容の作成・下書き管理という責務は独立している。
