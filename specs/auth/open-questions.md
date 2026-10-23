# open-questions: auth

`docs/prd/oauth-login.md`(prd-refine、2026-09-10)から転記。

| 番号 | 質問 | 推奨案 | 影響範囲 | 状態 |
|---|---|---|---|---|
| Q1 | Supabase Dashboard で Google provider が有効か。Redirect URLs に AikiBoard 分(`https://aiki-board.com/**` と `http://localhost:3000/**`)が登録済みか | AikiNote が同じ Supabase プロジェクトで OAuth 実装済みのため provider 自体は有効な可能性が高い。**Redirect URL は AikiBoard 分の追加が必要**(ユーザーの Dashboard 作業)。未登録だとコールバックが弾かれるため、実装完了後の動作確認前に必ず確認する | OAuthログイン全体 | open |
| Q2 | 既存のメール/パスワードアカウントと同じメールアドレスで Google ログインした場合の挙動 | Supabase の account linking 設定に依存する。既定では同一メールでも別アカウントになる場合と、自動リンクされる場合がある。実機で1件試して挙動を確認するのが確実 | 既存ユーザーのログイン導線 | open |
| Q3 | 非機能要件(パフォーマンス・アクセシビリティ)の具体的な目標値 | 既存のログイン画面と同水準で着手可。明確な数値目標なしで問題ない | OAuthボタンのUI | open |

いずれも**実装の着手をブロックしない**(Q1 は実装後の動作確認時に必要)。
