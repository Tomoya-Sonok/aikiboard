---
name: "prd-refine"
description: "Review a PRD in docs/prd/*.md from developer, QA, and security perspectives, ask targeted clarification questions in severity order, and write answers back into the PRD. Trigger on phrases like \"PRDを精緻化\", \"PRDレビュー\", or when the user gives a docs/prd/*.md path."
argument-hint: "docs/prd/{feature}.md のパス"
metadata:
  author: "aikiboard"
user-invocable: true
disable-model-invocation: false
---

## User Input

```text
$ARGUMENTS
```

パスが指定されていなければ、`docs/prd/` 配下で最も新しく更新されたPRDを候補として提示し、ユーザーに確認する。

## 振る舞い制約(このスキル共通)

- 推測で埋めない。不明点は `[TBD]` タグで残す
- 人間への質問は必ず「選択肢付き」で提示し、1回につき最大4問。白紙の質問は禁止
- 選択肢には必ず「上記以外(具体的に: ___)」を含める(`AskUserQuestion` ツールを使う場合はOther選択肢が自動的に用意されるため、明示的な追加は不要)
- 質問は重大度順(Critical → High → Medium → Low)に出し、1ラウンド最大4問で複数ラウンドに分ける

## 前提

- 参照する規約: `docs/constitution.md`(業務原則)、`docs/conventions.md`(開発規約)、`docs/ARCHITECTURE.md`(as-is実態)。内容はこのスキル内に複製せず、実行のたびに読み込む。
- レビュー対象: 引数または確認で決まった `docs/prd/{feature}.md`。

## 手順

1. 対象PRDと `docs/constitution.md` / `docs/conventions.md` / `docs/ARCHITECTURE.md` を読み込む。
2. PRDを3観点でレビューし、穴・曖昧さ・未明示の依存を洗い出す。検出した項目それぞれに重大度(Critical/High/Medium/Low)を付ける。
   - **開発者観点**: 入力値の範囲、エラー時の挙動、状態遷移、権限(owner/admin/member)が実装に足りる粒度で書かれているか。
   - **QA観点**: 各機能要件が「テスト可能な受け入れ条件」の形で書けるか(曖昧な形容詞だけで終わっていないか)。
   - **セキュリティ観点**: 認可(誰が何をできるか)、個人情報の扱い、入力検証、`docs/constitution.md` の原則(特に「認可の砦」「秘密情報」「公開範囲最小化」)との整合。
3. 検出した項目ごとに自分なりの**推奨案**を先に用意する。`Critical` → `High` → `Medium` → `Low` の順に、**1ラウンド最大4問**で質問する(全項目を一度に聞かない。Criticalが片付いてから次の重大度に進む)。1問の形式:
   - 推奨案(理由1文つき)
   - 代替案(1つ以上)
   - 「上記以外(具体的に: ___)」
4. 回答を得たら即座にPRD本文の該当箇所に反映し、その行または節の末尾に `[Clarified]` を付ける。ユーザーが「持ち帰る/わからない」と回答した項目は `[TBD]` のまま残す。
5. 全ラウンド終了時点で `[TBD]` が残っている項目を `specs/{feature}/open-questions.md` に転記する(ファイルが無ければ新規作成し、`specs/README.md` のファイル構成に従う)。転記した項目はPRD側にも `[TBD](→ open-questions.md 参照)` と併記する。
6. すべての `Critical` と `High` が `[Clarified]` になった時点で「精緻化完了。`/speckit-specify` に進めます」と宣言する。`Critical`/`High` が1件でも残っている場合は宣言せず、未解決項目を一覧で報告する。

## Done When

- [ ] PRDが developer / QA / security の3観点でレビューされ、各指摘に重大度が付いている
- [ ] 質問は重大度順・1ラウンド最大4問・選択肢付き(推奨案/代替案/上記以外)で行われている
- [ ] 回答が `[Clarified]` として、未解決が `[TBD]` としてPRDに反映されている
- [ ] 残った `[TBD]` が `specs/{feature}/open-questions.md` に転記されている
- [ ] Critical/High が全て解消していれば完了宣言、残っていれば未解決一覧を報告している
