# 公開ページ(道場ページ、集客用、未認証アクセス)

## 概要

`boards.is_public = true` のボードは、未認証ユーザーでも `/d/<slug>` で道場プロフィール(ロゴ・説明・指導者紹介・アクセス・問い合わせ先)と直近の公開稽古カレンダーを閲覧できる。メンバー限定情報(メンバー一覧・出欠等)は一切返さない設計。

## ユーザーストーリー

- 道場運営者として、公開ページ設定(公開ON/OFF、テーマカラー、ロゴ、紹介文、流派・所属組織、指導者紹介、アクセス、カレンダー表示有無、問い合わせ先表示有無)を管理画面から編集したい(`backend/src/routes/board-settings/index.ts`)。→ 編集操作自体は [settings](../settings/spec.md) の範囲。
- 見込み入門者(未認証訪問者)として、道場名・ロゴ・紹介文・アクセス・直近60日の公開稽古予定を見て、メールや電話、Webサイトで問い合わせたい(`frontend/src/components/features/public/PublicBoardView/PublicBoardView.tsx`)。
- 訪問者として、ページ下部の「メンバーの方はこちらからログイン」からログイン画面へ移動したい(同上)。
- 検索エンジン経由の集客を意図し、道場名や紹介文をタイトル/OGPに使うSEOメタデータが生成される(`frontend/src/app/[locale]/d/[slug]/page.tsx` の `generateMetadata`)。

## 機能要件

- ✅ `GET /api/public/boards/:slug` — 未認証(anon)でアクセス可能。`authMiddleware`を通さない設計。`is_public !== true`のボードは一律404(存在を隠す)— `backend/src/routes/public/index.ts`
- ✅ 公開データはボード名・slug・ロゴURL・テーマカラー・説明・`public_page_config`・紐づく道場名のみ(メンバー数や出欠などの内部情報は含まない)— 同上
- ✅ `GET /api/public/boards/:slug/events?from=&to=` — `is_public=true`の稽古のみ展開(繰り返し稽古のoccurrence展開+override適用込み)、期間は最大100日まで — 同上
- ✅ `/d/<slug>`は未認証/非メンバーアクセス時に自動で「メンバー向けダッシュボード」ではなく「公開ページ」を出し分け、非公開ボードなら認証済みは`/home`、未認証は`/login`へリダイレクト — `frontend/src/app/[locale]/d/[slug]/page.tsx`
- ✅ 公開ページのSEO対応(`generateMetadata`でタイトル/description/OGPを動的生成)— 同上
- ✅ 公開ページの表示ブロックは`public_page_config`のフラグで制御(`showCalendar`, `showContact`のON/OFF、`instructorIntro`/`access`/`organization`の有無で表示切替)— `PublicBoardView.tsx`
- ✅ 問い合わせ先(メール`mailto:`/電話`tel:`/Webサイト外部リンク)の表示 — 同上
- ✅ 公開カレンダーは直近60日分を読み取り専用リストで表示(日付・時間帯・場所・担当指導者)— `frontend/src/components/features/public/PublicCalendar/PublicCalendar.tsx`
- ❓ `002_create_core_tables.sql`のコメントに「見学申し込みフォームON/OFF等」と`public_page_config`の用途例が書かれているが、実装(`publicPageConfigSchema`・`PublicBoardView.tsx`とも)にそのようなフィールド・フォームは無い。設計段階の想定であって未実装と判断できる
- ❓ 公開ページからの「見学申し込み」「参加申請」導線はコード上見当たらない(`membership_requests`はログイン済みユーザー向けの参加申請機能であり、未認証訪問者向けの申込ではない)

## 画面・API・テーブルの対応

- 画面: `/[locale]/d/[slug]`(未認証/非メンバー時に`PublicBoardView`を表示)、`PublicCalendar`
- API:
  - `GET /api/public/boards/:slug`(認証不要)= tRPC `publicBoards.board`
  - `GET /api/public/boards/:slug/events`(認証不要)= tRPC `publicBoards.events`
- テーブル: `aikiboard.boards`(`is_public`列)、`aikiboard.board_settings`(`logo_url, theme_color_code, description, public_page_config`)、`aikiboard.board_dojo_masters`+`public."DojoStyleMaster"`(道場名表示用)、`aikiboard.events`/`aikiboard.event_overrides`(公開カレンダー用)

## 未決事項

- [TBD] 「見学申し込みフォーム」の実装計画・仕様(フォーム項目、送信先、通知方法)はコードから確認できない。マイグレーションのコメントのみに存在する未実装機能
- [TBD] 公開ページのカレンダー表示期間が60日固定(`HORIZON_DAYS=60`)である理由は不明
- [TBD] 公開ページの多言語対応の範囲(道場側が入力する自由記述項目は単一言語入力であり、これが仕様として意図されたものか不明)

## この粒度で切った理由

`backend/src/routes/public` という認証不要専用ルートを持ち、「メンバー以外の外部の目にどう見えるか」という他機能と異なるアクセス制御軸(anon許可)を担うため独立させた。設定の編集操作は [settings](../settings/spec.md) が担い、本機能は「表示・公開範囲」のみに責務を絞っている。
