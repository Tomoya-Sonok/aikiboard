# 道場内フィード+スレッド+AikiNote連携

## 概要

ボード内メンバーがテキスト+画像/動画添付付きの投稿を行い、各投稿にフラット1階層の返信(スレッド)ができる。AikiNote連携として「投稿ごとの選択式クロスポスト」と「AikiNote稽古日誌(SocialPost)の引用共有」の両方が実装されている。

## ユーザーストーリー

- メンバーとして、テキスト(最大5000字)・画像/動画(最大4枚、jpeg/png/webp/gif/mp4/mov/webm、100MB上限)を投稿したい(`frontend/src/components/features/feed/PostComposer/PostComposer.tsx`, `frontend/src/lib/feed/uploadAttachment.ts`)。
- メンバーとして、投稿時に「AikiNoteにもクロスポスト」チェックボックスを選び、AikiNote側の自分のフィードにも本文だけ流したい(`PostComposer.tsx`のcrossPostチェックボックス)。
- メンバーとして、自分のAikiNote投稿(稽古日誌等)一覧から1件選んで引用し、ボード投稿に添えて共有したい(`PostComposer.tsx`の引用ピッカーUI)。
- メンバーとして、投稿に返信(スレッド)し、返信者本人またはowner/adminが返信を削除できる(`PostThreadModal.tsx`)。
- メンバーとして、フィード一覧で「もっと見る」によるページネーション読み込みができる(`FeedView.tsx`)。

## 機能要件

- ✅ 投稿一覧取得(新しい順、ページネーションlimit/offset、既定20件・最大50件)— `backend/src/routes/board-posts/index.ts`
- ✅ 投稿詳細取得 — 同上
- ✅ 投稿作成(本文or添付or引用のいずれか必須、本文最大5000字、添付最大4件)— 同上
- ✅ 添付アップロード(署名付きURL発行→Storage直PUT→パス保存、越境防止チェック)— 同上, `uploadAttachment.ts`
- ✅ 添付表示用の短命署名付きDL URL発行 — 同上(`resolveSignedUrls`)
- ✅ 投稿削除(投稿者本人orowner/admin、Storage実体もベストエフォート削除)— 同上
- ✅ スレッド返信一覧・作成・削除(フラット1階層、返信者本人orowner/adminのみ削除可)— 同上
- ✅ 新規投稿・返信の通知([notifications](../notifications/spec.md)へ`notifyBoardMembers`/`createNotifications`)— 同上
- ✅ 操作履歴記録(`post.created`)— 同上
- ✅ **AikiNoteクロスポスト**(投稿ごとオプトイン、本文がある場合のみ、`SocialPost`へINSERT、visibility固定"public"、道場アカウント名義)— `backend/src/lib/aikinote.ts`, カラム`cross_post_to_aikinote`
- ✅ **AikiNote稽古日誌引用共有**(自分のSocialPost一覧取得→選択→`synced_from_post_id`として保存、他人の投稿の引用詐称防止チェック、削除済み投稿は内容を伏せて表示)— `aikinote.ts`, カラム`synced_from_post_id`
- ✅ クロスポスト失敗時のフォールバック(投稿自体は失敗させない、fire-and-forget相当)— `aikinote.ts`

## AikiNote連携の実装状況(重点確認結果)

CLAUDE.mdの「フィードのユーザー選択式クロスポスト、稽古日誌引用共有」は**両方ともコード上に実装されている**。クロスポストは`board_posts.cross_post_to_aikinote`(投稿時オプトイン)→投稿作成時に本文があれば`crossPostToAikinote()`が`public."SocialPost"`へINSERT。著者名義はボードの主道場(`board_dojo_masters.is_primary`)の`dojo_name`、なければボード名で代替。引用共有は`board_posts.synced_from_post_id`(AikiNote側`SocialPost.id`を参照、DB外部キーは将来追加予定とコメントあり)。投稿時に「本人のSocialPostか」「未削除か」を検証。SSO(同一Supabase Auth)・道場マスタ双方向書き込みは本機能の調査範囲外。

## 画面・API・テーブルの対応

- 画面: `frontend/src/app/[locale]/d/[slug]/feed/page.tsx`(`FeedView`)、`PostCard`, `PostComposer`, `PostThreadModal`
- API(tRPC): `boardPosts.{list, detail, create, aikinotePosts, remove, listThreads, createThread, removeThread, createUploadUrl}`
- テーブル: `aikiboard.board_posts`(`synced_from_post_id`, `cross_post_to_aikinote`カラム含む)、`aikiboard.board_post_attachments`(image/video enum)、`aikiboard.threads`、外部連携先`public."SocialPost"`(AikiNote側管理)

## 未決事項

- [TBD] 動画添付の「アップロードUI上の見た目」は画像と共通の`<input type="file">`から行う実装。専用の動画アップロード導線があるかは不明瞭
- [TBD] `public."SocialPost"`へのFK制約は「Phase 1で確認後に追加」とコメントされており、現状は型のみの緩い参照
- [TBD] クロスポスト時、本文が空(添付のみ・引用のみの投稿)の場合はクロスポストされない仕様だが、これがUI上の注意書きとしてフロントに存在するかは未確認

## この粒度で切った理由

独立したHonoルート(`board-posts`)・専用DBテーブル群(`board_posts`/`board_post_attachments`/`threads`)・専用フロントエンドディレクトリ(`components/features/feed`)を持ち、コード上の境界が明確に分離されている。AikiNote連携という横断的関心事(クロスポスト・引用)を本機能内で完結して記述できるため独立させた。
