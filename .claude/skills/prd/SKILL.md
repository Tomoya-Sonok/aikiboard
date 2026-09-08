---
name: "prd"
description: "Turn a rough note, meeting transcript, or feature request into a structured PRD using docs/prd/_template.md. Trigger on phrases like \"PRDにして\", \"要件をまとめて\", or when the user pastes an unstructured memo/transcript/request."
argument-hint: "貼り付けたいメモ・議事録・要望テキスト(省略時は直前の会話内容を使う)"
metadata:
  author: "aikiboard"
user-invocable: true
disable-model-invocation: false
---

## User Input

```text
$ARGUMENTS
```

入力が空の場合、直前の会話でユーザーが貼り付けたメモ・議事録・要望テキストを対象にする。それも無ければユーザーに入力を求める。

## 振る舞い制約(このスキル共通)

- 推測で埋めない。不明点は `[TBD]` タグで残す
- 人間への質問は必ず「選択肢付き」で提示し、1回につき最大4問。白紙の質問(選択肢のない自由記述のみを求める質問)は禁止
- 選択肢には必ず「上記以外(具体的に: ___)」を含める(`AskUserQuestion` ツールを使う場合はOther選択肢が自動的に用意されるため、明示的な追加は不要)
- 質問は重大度順(Critical → High → Medium → Low)に出し、1ラウンド最大4問で複数ラウンドに分ける

## 前提

- テンプレートは `docs/prd/_template.md`。このスキル内に節の内容を複製しない。実行のたびに読み込むこと。
- 既存機能の実態は `docs/ARCHITECTURE.md` と `specs/{feature}/spec.md` を参照する。

## 手順

1. `docs/prd/_template.md` を読み込み、節構成(背景・目的/対象ユーザー/ユーザーストーリー/機能要件[必須・任意]/非機能要件/画面・API・データ/スコープ外/未決事項/変更履歴)を把握する。
2. 入力テキストを読み、内容をテンプレートの各節に振り分ける。
   - 入力に無い情報は空欄にせず、その節に `[TBD]` と一言(何が分からないか)を添えて明記する。**創作(それらしい内容を推測で埋める)は禁止**。
   - ユーザーストーリーが入力に明示されていない場合、機能要件から機械的に逆生成しない。無ければ `[TBD]`。
3. `docs/ARCHITECTURE.md` と、関連しそうな既存の `specs/{feature}/spec.md` を確認する。入力内容がこれらと食い違う場合(例: 既に別方針で実装済み、既存の未決事項と矛盾する等)は、PRD末尾に **「既存との差分」** 節を追加して具体的に列挙する。食い違いが無ければこの節は作らない。
4. feature名(ファイル名用、英語kebab-case・2〜4語)を入力内容から決める。複数の妥当な候補があり自明に決められない場合のみ、上記の質問ルールに従って選択肢付きで確認する。それ以外は自分で決めてよい。
5. `docs/prd/{feature}.md` として保存する。変更履歴の1行目に本日の日付・「初版作成」を記録する。
6. 完了報告として、保存先パス・埋めた `[TBD]` の件数と一覧・「既存との差分」の有無を伝え、「次に `/prd-refine docs/prd/{feature}.md` を実行してください」と案内する。

## Done When

- [ ] `docs/prd/{feature}.md` が作成され、全節が具体的な内容か `[TBD]` のどちらかで埋まっている
- [ ] 既存ドキュメントとの矛盾があれば「既存との差分」節に列挙されている
- [ ] 保存先パスと次のアクション(`/prd-refine`)をユーザーに報告している
