# アクティビティログ

## 概要

ボード内の主要な操作(稽古・お知らせ・フィード投稿・出欠・メンバー入退会等)を時系列で表示する管理者向け操作履歴閲覧機能。閲覧専用で、書き込みは各機能ルートから行われる。有料プラン機能。

## ユーザーストーリー

- 管理者(owner/admin)として、ボード内で「誰が・いつ・何をしたか」を一覧で確認したい(`frontend/src/components/features/activity/ActivityView/ActivityView.tsx`)。
- 履歴が30件を超える場合は「もっと見る」でページングして遡って確認したい(`PAGE_SIZE=30`)。
- Freeプランのユーザーは、この機能が有料プラン限定であることを案内され、アップグレードを検討する動線に誘導される(`FeatureLocked`コンポーネント、`nav.pro`バッジ)。

## 機能要件

- ✅ 操作履歴の一覧取得API(`GET /api/activity-logs?boardId=&limit=&offset=`、新しい順)— `backend/src/routes/activity-logs/index.ts`
- ✅ 対象アクション種別は9種(`event.created/updated/deleted`, `announcement.published`, `post.created`, `rsvp.responded`, `member.joined/left/removed`)に限定 — `backend/src/lib/activity.ts`(`ActivityAction`型)
- ✅ アクセス制御はowner/adminのみ(`boardAdminMiddleware`)+ feature_flag `activity_log`(`requireFeature("activity_log")`)の二重ガード — `activity-logs/index.ts`
- ✅ 非メンバーは404、一般メンバーは403、feature_flag無し(Freeプラン相当)は403(`code:"feature_locked"`)— `activity-logs.test.ts`
- ✅ フロントの表示メッセージはactionを`.`→`_`に変換したi18nキーでテンプレート化(例: 「{name}さんが稽古を追加しました」)
- ❓ アーカイブ・会計・Todo・ボード設定の変更操作(作成/更新/削除)はいずれも`logActivity`を呼んでおらず、アクティビティログに記録されない。管理工数削減が主軸の製品コンセプト上、これらの操作履歴を対象外としたのが意図的仕様か未実装かは判断できない
- ❓ 書き込み失敗時はログのみでスロー(本処理を継続)という設計。ログの欠落を許容する仕様として要件文書側で議論されているかは不明

## 画面・API・テーブルの対応

- 画面: `frontend/src/app/[locale]/d/[slug]/activity/page.tsx` → `ActivityView`
- API: tRPC `activityLogs.list`(→`GET /api/activity-logs`)
- テーブル: `aikiboard.activity_logs`。RLSはadmin/ownerのみSELECT許可、INSERTはservice_role経由のみ

## 未決事項

- [TBD] アーカイブ/会計/Todo/ボード設定の操作をログ対象に含めるか
- [TBD] `activity_log`が有料機能である理由・料金プラン上の位置づけ(CLAUDE.md本文ではアーカイブ・会計のみ「MVP新規機能(有料)」と明記されているが、feature_flagのseedデータでは`activity_log`も有料機能として定義されている)

## この粒度で切った理由

専用ルート(`activity-logs`)・専用テーブル(`activity_logs`)・専用画面(`ActivityView`)という1対1の実装境界を持つため独立させた。[archive](../archive/spec.md)・[finance](../finance/spec.md)と共に有料機能(feature_flag)の対象という横断的な制御軸を持つ。
