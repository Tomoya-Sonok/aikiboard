# specs/ の構成規約

`specs/{feature}/` は機能ごとの正典を置くディレクトリ。**`spec.md` が正典であり、コードは派生物**である。仕様を変える場合は `spec.md → plan.md → tasks.md → コード` の順で反映する。コードだけを直して `spec.md` を放置することは禁止する。

## ファイル構成

| ファイル | 役割 | 必須/任意 |
|---|---|---|
| `spec.md` | 機能仕様(概要・ユーザーストーリー・機能要件・画面/API/データ対応・未決事項) | 必須 |
| `plan.md` | 実装方針(`/speckit-plan` が生成)。技術選定・影響範囲・実装順序 | 機能追加時に作成 |
| `tasks.md` | 実装タスクの分解(`/speckit-tasks` が生成) | 機能追加時に作成 |
| `open-questions.md` | 仕様上の未決事項のうち、実装着手前に人間の判断が必要なもの | 未決事項がある場合のみ |

## open-questions.md の書式

| 番号 | 質問 | 推奨案 | 影響範囲 | 状態 |
|---|---|---|---|---|
| Q1 | ... | ... | ... | open |

- **状態**: `open`(未回答) / `answered`(回答済み) / `deferred`(今は判断せず持ち越し)
- `answered` になった項目は、対応する PRD(`docs/prd/{feature}.md`)と `spec.md` の該当箇所に `[Clarified]` を付けて反映する(`.claude/skills/prd-refine/SKILL.md` の手順を参照)。

## 運用ルール

- 既存14機能(`auth` / `boards` / `dojo-masters` / `public` / `events` / `announcements` / `notifications` / `members` / `feed` / `activity` / `archive` / `finance` / `todo` / `settings`)の `spec.md` は、`docs/ARCHITECTURE.md` 作成時に現状(as-is)から逆生成したものである。以後これらの機能に変更を加える際は、該当 `spec.md` を先に更新してからコードに着手する。
- 新機能は `docs/prd/_template.md` からPRDを作成 →(`/prd-refine` で精緻化)→ `/speckit-specify` で `specs/<feature>/spec.md` を生成 → `/speckit-plan` → `/speckit-tasks` → `/speckit-implement` の順で進める。
- `spec.md` 内の `[TBD]` は実装前に解消するか、`open-questions.md` に切り出して人間の判断を仰ぐ。放置したまま実装に着手しない。
- 機能の粒度は「`backend/src/routes/<name>` と `frontend/src/components/features/<name>` の実装境界」に合わせる(既存14機能の切り方を踏襲する)。1つの `spec.md` が複数のbackendルート/frontendディレクトリにまたがる場合は、`spec.md` の「この粒度で切った理由」に明記する。
