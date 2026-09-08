# 道場マスタ双方向連携

## 概要

ボードは AikiNote 側が管理する共有マスタ `public."DojoStyleMaster"` に紐付く。検索は承認済み道場のみを対象とし、見つからない場合はその場で新規追加(未承認状態)できる「双方向書き込み」機能を持つ。

## ユーザーストーリー

- ボード作成者として、道場名を入力してオートコンプリートから既存の道場を選択したい(300msデバウンス検索、キーボード操作対応)— `frontend/src/components/features/boards/DojoMasterSelect/DojoMasterSelect.tsx`
- 検索しても道場が見つからない場合、その場で新しい道場名を登録し、そのままボードに紐付けたい(「『{name}』を新しい道場として追加」ボタン)— 同上
- 選択した道場を確認・変更したい(選択後は「道場名(タップで再編集)+クリア」表示)— 同上

## 機能要件

- ✅ `GET /api/dojo-masters?q=&limit=` — 承認済み(`is_approved=true`)の道場のみを`dojo_name`/`dojo_name_kana`の部分一致(ilike)で検索、最大50件 — `backend/src/routes/dojo-masters/index.ts`
- ✅ `POST /api/dojo-masters` — 新規道場追加。`dojoName`(1-100文字必須)、`dojoNameKana`(任意100文字以内)、`region`(任意100文字以内)。作成者は認証ユーザー(`created_by_user_id`)、`is_approved: false`で作成(モデレーション前提)— 同上
- ✅ 新規追加時の重複防止: 大文字小文字無視の完全一致(ilike)で既存道場があれば新規作成せず既存を返す(`existed: true`)、連続空白を1つに正規化 — 同上
- ✅ PostgRESTの`or()`フィルタへのインジェクション対策として区切り文字/ワイルドカードをサニタイズ(`sanitizeQuery`)— 同上
- ✅ フロントのオートコンプリート: ↑↓移動、Enter選択、Esc閉じる、ARIA combobox/listbox対応、外側クリックで閉じる — `DojoMasterSelect.tsx`
- ✅ 承認済みバッジの表示(`is_approved`がtrueの候補にチェックマーク+「承認済み」表示)— 同上
- ✅ ボード作成時に`POST /api/boards`側でも道場マスタの存在チェックを再実施 — `backend/src/routes/boards/index.ts`
- ❓ 新規追加された道場(`is_approved: false`)を承認するフロー(承認画面・API)がこのリポジトリ内に見当たらない。AikiNote側で承認する前提と思われるが、コード上の直接的根拠はない
- ❓ ボード作成後に紐付け道場を変更・追加する導線が存在しない([boards](../boards/spec.md)でも同様の指摘)。「複数紐付けは将来対応」とコメントにあるのみ

## 画面・API・テーブルの対応

- 画面: `DojoMasterSelect`(`BoardCreateForm`から利用)
- API:
  - `GET /api/dojo-masters`(認証必須)= tRPC `dojoMasters.search`
  - `POST /api/dojo-masters`(認証必須)= tRPC `dojoMasters.create`
- テーブル: `public."DojoStyleMaster"`(AikiNote側管理。列: `id, dojo_name, dojo_name_kana, region, is_approved, created_by_user_id, created_at, updated_at`)、紐付け先 `aikiboard.board_dojo_masters`

## 未決事項

- [TBD] 未承認道場(`is_approved: false`)の承認プロセス(誰が・どの画面で承認するか)はこのリポジトリのコードからは確認できない
- [TBD] `region`列はAPIで受け付けるが、フロントの`BoardCreateForm`/`DojoMasterSelect`からは入力UIが無く常に未指定。将来の入力項目として温存されているのか不明

## この粒度で切った理由

`backend/src/routes/dojo-masters` という専用ルートを持ち、AikiNote側の共有マスタへの読み書きという他機能に無い横断的関心事(外部スキーマへの書き込み)を担うため独立させた。[boards](../boards/spec.md)作成フローの一部として呼ばれるが、双方向書き込みという固有のリスク・仕様を持つため分離して記述する。
