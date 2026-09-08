# アーカイブ(階層構造ページ、有料プラン機能)

## 概要

管理者が稽古内容・議事録・演武会動画などを階層構造のページとして長期保存できる機能。全メンバーが閲覧可能、作成・編集・削除はowner/adminのみ。有料プラン機能。

## ユーザーストーリー

- 管理者として、稽古内容や議事録を親子関係を持つページ(木構造)で整理して保存したい(`archives`テーブルの`parent_id`self-FK、`frontend/src/components/features/archive/ArchiveView/ArchiveView.tsx`のツリー描画)。
- ページ作成時に画像・動画(最大12件、100MB以下、対応形式のみ)を添付したい(`ArchiveForm.tsx`)。
- タイトル・本文のフリーワードでアーカイブ内を横断検索したい(`GET /api/archives/search`)。
- 一般メンバーとして、管理者がまとめたアーカイブページを閲覧したい(作成/編集ボタンは`canManage`の場合のみ表示)。
- Freeプランのユーザーは、この機能へのアクセス時に「有料プラン限定」の案内を見る(`FeatureLocked`)。

## 機能要件

- ✅ 階層ページのCRUD(`GET/POST /api/archives`, `GET/PATCH/DELETE /api/archives/:id`)— `backend/src/routes/archives/index.ts`
- ✅ 閲覧は全メンバー(`archiveMemberMiddleware`)、作成/編集/削除/アップロードURL発行はowner/admin(`archiveAdminMiddleware`)— `archives.test.ts`
- ✅ feature_flag `archive`によるプラン制御(`requireFeature("archive")`を全エンドポイントに適用)— `archives/index.ts`
- ✅ フロント側でも`board.features.includes("archive")`を確認し、なければ`FeatureLocked`を表示(バックエンドと二重の防御)— `frontend/src/app/[locale]/d/[slug]/archive/page.tsx`
- ✅ ナビゲーションに`pro:true`バッジを表示 — `frontend/src/lib/boards/navItems.ts`
- ✅ 添付は画像/動画/`aikinote_page`(AikiNote稽古日誌引用)の3種をDB上サポート — `005_create_archive_tables.sql`
- 🚧 `aikinote_page`(AikiNote引用)添付は「列のみ確保し将来対応」とコード注記あり、実装は未着手
- 🚧 `order_index`によるページ並び替えはAPI(`PATCH`の`orderIndex`)に用意されているが、フロントにドラッグ&ドロップ等の並び替えUIは見当たらない(新規作成時は末尾に自動追加のみ)
- ✅ タイトル最大200文字、添付最大12件のバリデーション(フロント/バックエンド双方)
- ❓ 検索は`GET /api/archives/search`でボード内最大500件を毎回全文フェッチしてサーバー側で部分一致フィルタする実装(`SEARCH_FETCH_MAX=500`)。パフォーマンス上の暫定実装か仕様として妥当かは不明

## 画面・API・テーブルの対応

- 画面: `frontend/src/app/[locale]/d/[slug]/archive/page.tsx` → `ArchiveView` / `ArchiveForm`
- API: tRPC `archives.list/detail/search/create/update/remove/createUploadUrl`
- テーブル: `aikiboard.archives`, `aikiboard.archive_attachments`。添付実体はSupabase Storageの`board-media`バケット(prefix `archive`)

## 未決事項

- [TBD] AikiNote稽古日誌引用(`aikinote_page`)の実装スケジュール・仕様詳細
- [TBD] ページ並び替えUIを今後実装するか(APIは対応済み)
- [TBD] 検索が500件上限で足りるかの想定ボード規模

## 有料プラン制御の総括(archive/finance横断)

`hasFeature`/`getEntitledFeatures`(`backend/src/lib/features.ts`)は`board_subscriptions→plans→plan_features`を辿ってプランごとの利用可能機能セットを算出する。決済(Stripe)は未実装のため「現段階では全ボードがFreeのため有料機能はロックされる(正しい挙動)」とコメントに明記。本機能は全エンドポイントで`requireFeature`+フロント`FeatureLocked`の二重制御が実装済み(✅)。[todo](../todo/spec.md)・[settings](../settings/spec.md)にはこの制御が無い。

## この粒度で切った理由

専用ルート(`archives`)・専用テーブル群(`archives`/`archive_attachments`)・専用画面(`ArchiveView`/`ArchiveForm`)という1対1の実装境界を持つため独立させた。
