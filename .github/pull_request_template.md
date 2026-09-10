## 変更内容
<!-- 何を変えたか。背景・動機は PR タイトルで伝わらない場合のみ書く -->

## specs/ の更新
<!-- 仕様変更は spec.md が正、コードは派生物(specs/README.md)。該当 feature の spec.md を先に更新したか -->
- [ ] 更新した(対象: `specs/____/spec.md`)
- [ ] 不要(既存仕様の範囲内の変更・バグ修正等)
- [ ] 未更新 → 理由:

## open-questions への影響
<!-- 対象 feature に open-questions.md がある場合、今回の変更で解消/追加された項目があるか -->
- [ ] 影響なし、または対象 feature に open-questions.md が無い
- [ ] 解消した項目あり → `specs/____/open-questions.md` を更新済み
- [ ] 新たに判明した未決事項あり → `specs/____/open-questions.md` に追加済み

## 動作確認
### 方法
<!-- 何を、どういう手順で確認したか。再現できる粒度で書く -->

### チェック
- [ ] ローカルで pnpm dev → 当該機能を手動操作
- [ ] Vercel preview URL で本番同等環境を確認
- [ ] CI（frontend_ci / backend_ci）グリーン

## 影響範囲
<!-- DB スキーマ変更? RLS 追加? 既存機能への副作用? feature_flag への影響? -->
- [ ] DB マイグレーション無し
- [ ] DB マイグレーションあり → ファイル: `backend/src/migrations/XXX_*.sql`
      - [ ] ローカルで `pnpm supabase db reset` 成功
      - [ ] **本番 Dashboard で適用完了 + 動作確認済み**（PR マージ後に self-check）

## テスト
- [ ] 追加/変更したロジックに対する Vitest テストを追加した
- [ ] テスト追加なし → 理由: <例: 表示のみの component、Phase 2 で実装予定 等>

## Storybook
- [ ] 新規/変更したコンポーネントに対応する `*.stories.tsx` を追加した
- [ ] story 未追加 → 理由: <例: page level component、Server Component でデータ取得が複雑 等>

## メモ
<!-- レビュー時に注目してほしい点、リファクタの動機、未対応の宿題など -->
