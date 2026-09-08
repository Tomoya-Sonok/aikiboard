# ボード作成・ダッシュボード/シェル

## 概要

「ボード」= 合気道道場の組織を1単位として作成するワークスペース。作成時に道場マスタへの紐付け(最低1件必須)を行い、作成者が owner になる。ボード配下は共通シェル(サイドバー+ヘッダー)で統一され、`/d/<slug>` が認証状態・メンバー判定でメンバー向けダッシュボードと公開ページを出し分ける。

## ユーザーストーリー

- ログイン済みユーザーとして、ボード名・URL(slug)・道場・説明・公開/非公開を入力してボードを作成し、作成後は自分がオーナーとして管理したい(`frontend/src/components/features/boards/BoardCreateForm/BoardCreateForm.tsx`)。
- フォーム案内文言「あとから変更できますので、気軽にご入力ください」から、ボード名・説明などは後から変更可能という前提の利用シーンが読み取れる(`frontend/src/translations/ja.json` boards.create.subtitle)。
- 複数ボードに所属するユーザーとして、サイドバーのボードアイコンで別ボードへ素早く切り替えたい(`BoardSidebar.tsx`)。
- ログイン直後のユーザーとして、最後に開いていたボード(cookie記憶)、または先頭のボードへ自動的に着地したい。所属ボードが無ければボード作成へ誘導されたい(`frontend/src/app/[locale]/(authenticated)/home/page.tsx`)。

## 機能要件

- ✅ ボード作成フォーム: 名前(1-50文字必須)、slug(3-63文字、`^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$`)、公開/非公開、説明(500文字以内・任意)、道場(1件必須)— `BoardCreateForm.tsx`, `backend/src/routes/boards/index.ts`
- ✅ backendでslug一意性の事前チェック+INSERT時のunique制約違反(23505)も409で捕捉 — `boards/index.ts`
- ✅ ボード作成はservice_role(RLSバイパス)で実行し、途中失敗時はboardをDELETEしてロールバック(擬似トランザクション、コメントで「RLSの鶏卵問題」明記)— `boards/index.ts`
- ✅ 作成と同時に `board_members`(owner)・`board_settings`・`board_dojo_masters`(先頭=primary)・`board_subscriptions`(Freeプラン)を作成 — `boards/index.ts`
- ✅ ボード1件にownerは必ず1名(DB制約 `idx_board_members_one_owner`)— `002_create_core_tables.sql`
- ✅ ログイン後の着地先リゾルバ: 所属ボード一覧を取得しcookie(`ab_last_board_slug`)優先、なければ先頭、所属ゼロなら`/boards/new` — `home/page.tsx`, `frontend/src/lib/boards/resolveDefaultBoard.ts`
- ✅ `/d/<slug>` は共通レイアウトで認証状態・メンバー判定を行い、メンバーなら`BoardShell`(サイドバー+ヘッダー)を被せ、非メンバー/未認証はシェル無しで内容(公開ページ)を表示 — `frontend/src/app/[locale]/d/[slug]/layout.tsx`
- ✅ サイドバー: 所属ボード一覧(アイコン切替+新規作成)、ナビ項目(home/calendar/announce/feed/archive/money/members/todo/activity/settings)、admin限定ナビの出し分け、ログアウト — `BoardSidebar.tsx`
- ✅ ヘッダー: URLセグメントからタイトルを動的解決、ボード名表示、モバイル用ハンバーガー、通知ベル(実装済み)— `BoardHeader.tsx`
- 🚧 ヘッダーの検索バー・言語切替ボタン・アカウントメニューは「表示のみ(ダミー)。本実装は後続PR」とコードコメントに明記 — `BoardHeader.tsx:26`
- 🚧 ダッシュボードの「最近のフィード」はダミーデータ固定表示。「次の稽古」「お知らせ」カードは実データ — `frontend/src/components/features/boards/dashboard/DashboardCards.tsx`
- ✅ ボード一覧取得時にプラン名(Freeフォールバック)・メンバー数を付与 — `boards/index.ts`
- ✅ ボード詳細取得(`GET /api/boards/:slug`)は非メンバーには公開ボードのみ許可、非公開ボードは404で存在を隠す — `boards/index.ts`
- ❓ ボード作成後に道場マスタの紐付けを変更/追加する画面が見当たらない(`board_dojo_masters`を更新するAPI/UIはボード作成時のみ)。設定画面にも道場変更機能なし

## 画面・API・テーブルの対応

- 画面: `/[locale]/boards/new`(`BoardCreateForm`)、`/[locale]/home`(リゾルバ、UI無し即redirect)、`/[locale]/d/[slug]`(共通レイアウト+ダッシュボード/公開ページ出し分け)、`BoardShell`/`BoardSidebar`/`BoardHeader`
- API:
  - `GET /api/boards`(認証必須)= tRPC `boards.list`
  - `GET /api/boards/:slug`(認証必須)= tRPC `boards.getBySlug`
  - `POST /api/boards`(認証必須)= tRPC `boards.create`
- テーブル: `aikiboard.boards`, `aikiboard.board_settings`, `aikiboard.board_members`, `aikiboard.board_dojo_masters`, `aikiboard.board_subscriptions`, `aikiboard.plans`

## 未決事項

- [TBD] ボード名・slug・道場を「あとから変更できる」とUI文言にあるが、slug変更UI/APIはコード上見当たらない。slug変更の可否・仕様は不明
- [TBD] `dojoMasterIds` はAPIが配列(最大10件)を受け付けるが、`BoardCreateForm`は単一選択のみ。コメント「複数紐付けは将来対応」の詳細計画は不明
- [TBD] Freeプラン以外へのアップグレード導線(決済)は未実装。有料化ロードマップの詳細は本機能の範囲外
- [TBD] **権限マトリクス(要件定義書3.2)にある「アドミン任命・解除」「オーナー譲渡」「ボード削除」は、いずれもAPI/UIが存在しない**(`backend/src/routes/members/index.ts` にロール変更なし、`backend/src/routes/boards/index.ts` はGET/GET/POSTのみ)。owner保護のメッセージ(「オーナーは退会できません。先に権限を引き継いでください」)は実装されているが、引き継ぎの実現手段自体がコード上にない。

## この粒度で切った理由

「場を作る」という単一の関心事に対応する専用ルート(`backend/src/routes/boards`)・専用テーブル群(`boards`/`board_settings`/`board_members`/`board_dojo_masters`/`board_subscriptions`)・専用ディレクトリ(`components/features/boards`)を持つため独立させた。[auth](../auth/spec.md)の後、[dojo-masters](../dojo-masters/spec.md)(外部連携)・[public](../public/spec.md)(公開)へ続く導線上の中核に位置する。
