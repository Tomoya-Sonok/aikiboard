# ボード設定

## 概要

owner/adminが公開ページの内容(ロゴ・テーマカラー・紹介文・問い合わせ先等)と公開フラグを編集する設定画面。閲覧は全メンバー、更新はowner/adminのみ。

## ユーザーストーリー

- 管理者として、道場の紹介文・所属組織・ロゴURLなどの基本情報を編集したい(`frontend/src/components/features/settings/SettingsView/SettingsView.tsx`)。
- 管理者として、公開ページを有効にして、未ログインの人にも道場ページ(稽古カレンダー含む)を見られるようにしたい(「未ログインの方も道場ページ(稽古カレンダー含む)を閲覧できるようになります。」)。→ 公開後の実際の見え方は[public](../public/spec.md)を参照。
- 管理者として、10色のテーマカラーからボードの色味を選びたい(`THEMES`スウォッチ、10色: sumi/dou/fukamidori/ai/enji/yamabuki/shikon/toki/usuzumi/nezumi)。
- 管理者として、公開ページに稽古カレンダーや問い合わせ先を表示するか個別にON/OFFしたい(`showCalendar`/`showContact`チェックボックス)。
- 管理者として、問い合わせ先(メール・電話・URL)を設定し、見学申込等の導線にしたい。

## 機能要件

- ✅ 設定取得(`GET /api/board-settings`、閲覧はメンバー全員)、更新(`PATCH /api/board-settings`、owner/adminのみ)— `backend/src/routes/board-settings/index.ts`
- ✅ `board_settings`(1:1)と`boards.is_public`を一括更新するAPI設計 — 同上
- ✅ テーマカラーは固定10色のenum的バリデーション(`THEME_CODES`、不正値は400)— `board-settings.test.ts`
- ✅ 公開ページ表示設定(`publicPageConfig`: 指導者紹介・アクセス・所属組織・問い合わせ先・カレンダー表示/問い合わせ表示ON-OFF)をJSONBで保存 — `002_create_core_tables.sql`
- ❓ コード注記に「厳密なプラン制限(テーマ変更・公開ページは有料)は決済実装後にrequireFeatureで絞る余地を残す。現状は管理者なら保存できる」とあり、**本機能にはfeature_flagによるプラン制御が実装されていない**。一方`007_create_feature_flag_tables.sql`のseedデータでは`board_theme`と`public_page`はFreeプランの機能一覧に含まれており(有料機能扱いされていない)、コードコメントの「有料」という記述とseedデータの実際の割当てが矛盾している。どちらが最新の意図か本調査からは判別不可
- ✅(参考)ナビゲーション項目定義では`settings`に`pro`/`adminOnly`フラグはいずれも付与されていない(全メンバーがナビには表示、ページ内で`canManage`判定してリダイレクト)

## 画面・API・テーブルの対応

- 画面: `frontend/src/app/[locale]/d/[slug]/settings/page.tsx` → `SettingsView`(※`ArchiveForm`/`TodoForm`のような分離した`Form`コンポーネントは無く、`SettingsView`単体がフォームを兼ねる)
- API: tRPC `boardSettings.get/update`
- テーブル: `aikiboard.board_settings`, `aikiboard.boards`(`is_public`列)
- 🚧 **ボード削除UI(「危険な操作」セクション)は本画面に置く**(owner にのみ表示)。仕様の正は [boards](../boards/spec.md) の「ボード削除の仕様」節。

## 未決事項

- [TBD] テーマカラー変更・公開ページ機能を将来的に有料化するか(コードコメントは「有料」想定だがseedデータはFree扱いで実装も未ガード)
- [TBD] `board_theme`/`public_page`のfeature_flag上の位置づけの最終確定

## この粒度で切った理由

専用ルート(`board-settings`)・専用テーブル(`board_settings`)・専用画面(`SettingsView`)という1対1の実装境界を持つため独立させた。[public](../public/spec.md)が「表示」を担うのに対し、本機能は「編集」に責務を絞っている。
