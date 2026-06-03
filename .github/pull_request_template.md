## 変更内容
<!-- 何を変えたか。背景・動機は PR タイトルで伝わらない場合のみ書く -->

## 動作確認
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
