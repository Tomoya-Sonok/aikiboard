# AikiBoard Constitution

AikiBoard というアプリケーション固有の、譲れない原則。コーディングスタイル等の実装規約は [`docs/conventions.md`](conventions.md) を参照。根拠の詳細は [`docs/ARCHITECTURE.md`](ARCHITECTURE.md) を参照。

> **spec-kit constitution との関係**: このリポジトリには spec-kit の `.specify/memory/constitution.md` が存在するが、2026-09-07時点でテンプレートのまま未記入。本ドキュメントを正典とする。今後 `/speckit-constitution` を実行する場合は、本ファイルの内容を転記するか、本ファイルへのポインタとして扱うこと(重複管理はしない)。

## 1. 認可の砦は backend ミドルウェアのみ

新規APIエンドポイントは必ず `backend/src/middleware/boardAccess.ts` のミドルウェア(`boardMemberMiddleware` / `boardAdminMiddleware` 等)を通すこと。RLSはanon直接アクセス用の二重防御であり、backendの認可を代替しない。
**根拠**: backendは常にservice_roleで動作しRLSを完全バイパスするため(`docs/ARCHITECTURE.md` 3.2 / 5.6)。

## 2. 非メンバーにはボードの存在を隠す

非メンバーがボードや配下リソースにアクセスした場合、403ではなく404を返し「存在するが権限がない」ことを教えない。
**根拠**: `boardAccess.ts` および複数ルートで一貫して採用されている設計方針(`docs/ARCHITECTURE.md` 5.6)。

## 3. `public` スキーマの共有テーブルは変更しない

`public."User"` `public."DojoStyleMaster"` `public."SocialPost"` はAikiNoteと共有するテーブルであり、AikiBoard実装から直接ALTER・スキーマ変更しない。書き込みは許可された範囲(道場マスタ新規追加、フィードのクロスポスト)に限る。
**根拠**: 要件定義書「共通テーブル変更の禁止」、`docs/ARCHITECTURE.md` 4章。

## 4. 秘密情報はハードコードしない

`SUPABASE_SERVICE_ROLE_KEY` `RESEND_API_KEY` `SUPABASE_JWT_SECRET` 等はコードに書かず、環境変数(`wrangler secret` / `.env.local`)経由でのみ扱う。
**根拠**: `backend/wrangler.toml` の秘密値運用コメント、`.env.local.example` の存在(`docs/ARCHITECTURE.md` 1.4)。

## 5. AI生成コードは PR 経由でのみ main に入る

mainブランチへの直接pushは緊急hotfix以外禁止。AIが生成した変更も例外なくPRを経由する。
**根拠**: ADR 0001(開発フローとPR運用)。

## 6. 有料機能は backend/frontend 二重ガード

feature_flagで制御する機能(archive / accounting / activity_log 等)は、backend側の `requireFeature()` と frontend側の `board.features.includes()` の両方でガードする。片方のみの実装は不可とする。
**根拠**: `docs/ARCHITECTURE.md` 5.6、[`specs/archive/spec.md`](../specs/archive/spec.md)、[`specs/finance/spec.md`](../specs/finance/spec.md)。

## 7. 公開ボードが未認証者に見せる情報は最小限

`boards.is_public = true` でも、未認証者に見せてよいのは道場プロフィールと `events`(公開稽古カレンダー)のみ。メンバー一覧・フィード・会計・アーカイブ・出欠の詳細は公開しない。
**根拠**: 要件定義書のRLS方針、[`specs/public/spec.md`](../specs/public/spec.md)。

## 8. データ削除はリソースの性質で使い分ける

- 招待リンクは失効(`revoked_at` による soft delete)にとどめ、再有効化しない
- メンバーの退会・削除時、その人物に紐づく参照データ(出欠・既読)は物理削除する
- アーカイブ・お知らせ等の本体削除は CASCADE による物理削除とする
- 今後ボード削除機能を追加する場合も、この使い分けの方針を踏襲する

**根拠**: `docs/ARCHITECTURE.md` 4章のテーブル設計、[`specs/members/spec.md`](../specs/members/spec.md)。
