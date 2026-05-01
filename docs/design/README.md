# docs/design/ — Claude Design Handoff Kit

このフォルダは **Claude Design**（Anthropic Labs の Research Preview、`claude.ai/design`）で
AikiBoard のデザインを作るための持ち込み資料一式です。

## ファイル一覧

| ファイル | 用途 | Claude Design 上での扱い |
|---|---|---|
| `01_design-brief.md` | プロダクト前提・IA・スコープ・サンプルデータ | 「Drop files here」にドロップ |
| `02_tokens.css` | デザイントークン（色／10 道場テーマ／タイポ／余白／角／影／z-index） | 「Start with context → Design System」に追加 |
| `03_prompts.md` | 初回プロンプト＋フォロー用プロンプト集 | 手元リファレンス。チャット欄には必要分のみ貼る |
| `README.md` | この案内 | — |

## 使い方（最短ルート）

1. `claude.ai/design` で新規プロジェクト（例: `AikiBoard Prototype`）を作成
2. 左上「Start with context」→ **Design System** に `02_tokens.css` を追加
3. キャンバス下部「Drop files here」に以下をまとめて投入:
   - `01_design-brief.md`
   - `../requirements.md`（正式版要件定義）
   - `../draft/mock.tsx`（既存 React モック、レイアウト参考）
   - `../../../aikinote/frontend/src/styles/variables.css`（姉妹サービスのトークン姿勢合わせ）
4. プロンプト欄の `Wireframe` チップは外す（ハイファイ指定）
5. `03_prompts.md` の **①初回プロンプト** をチャット欄に貼り付けて送信
6. 成果物を見て、`03_prompts.md` の **②フォロー用プロンプト** から必要なものを追い足し

## 戻ってきた後の扱い

Claude Design で固まったら:

- HTML export → `docs/design/export/<yyyy-mm-dd>/` に保存
- handoff bundle（Claude Code 向け）は Phase 0 リポジトリ初期化時に `frontend/` へ渡す想定
- トークンは `02_tokens.css` を最終決定版として `frontend/src/styles/variables.css` に取り込み（変数名は `--ab-*` を尊重）

## 運用メモ

- **`02_tokens.css` がデザインと実装の両方の正** という運用。デザイン修正でトークンの値を変えたら必ずここを更新する
- 10 道場テーマの hex は要件 9.4 の「仮」。デザイナー確定後に差し替え予定
- 要件定義書 (`../requirements.md`) が上位仕様。本フォルダと食い違う場合は要件定義書が正。改訂したらこちらも追従すること
