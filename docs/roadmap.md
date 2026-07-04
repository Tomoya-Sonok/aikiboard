# AikiBoard 普及ロードマップ — MVP 一巡後の残タスクと実装方針

> - **作成日**: 2026-07-04(基準コミット: main `5b7d37b` = PR #99 マージ後)
> - **目的**: MVP の主要機能が一巡した AikiBoard を、「より多くの合気道道場(道場長・事務局メンバー)に実際に使ってもらえる」状態へ引き上げるための残タスク台帳と実装方針。
> - **読者**: 次の開発セッション(AI エージェント / 人間)。**このドキュメント単体を読めば、他の文脈なしで後続タスクへ着手できる粒度**で書いている。
> - **位置づけ**: 機能仕様の正は [`requirements.md`](./requirements.md)、開発手順は [`development-guide.md`](./development-guide.md)、意思決定記録は [`adr/`](./adr/)。本書は「**次に何を・なぜ・どうやるか**」の台帳であり、着手時は該当タスクの記述 → 参照先ドキュメントの順で読むこと。
> - **保守**: タスクに着手・完了したら本書の該当行を更新する(実装とドキュメントのセット更新原則)。

---

## 1. 現在地(2026-07-04)

### 1.1 実装済み機能(すべて main マージ済み)

| 機能 | PR | 備考 |
|---|---|---|
| 認証(メール/パスワード)+ 3階層ロール + ボード作成 | #51〜#54 | JWKS(ES256)検証。**OAuth は未配線** |
| ダッシュボード + シェル(サイドバー/ヘッダー) | #58〜#63 | ボード切替(Slack 風)、cookie で最終ボード記憶 |
| 稽古カレンダー + 出欠管理(定期稽古・例外・名簿) | #64〜#67 | 自前 RRULE サブセット、Asia/Tokyo 固定 |
| お知らせ配信(下書き→公開、Tiptap、メール通知) | #70〜#74 | メールは Resend。**本番ドメイン未認証** |
| メンバー管理(一覧・退会/削除・共有招待リンク・参加申請承認) | #75〜#78, #80 | 申請の発見・送信導線は AikiNote 側(別リポジトリ) |
| SP レスポンシブ基盤(ドロワー/シート化、カレンダー SP) | #81〜#84 | 外側余白は共通シェル `.content` が一括で持つ |
| 道場内フィード + スレッド + AikiNote 連携 | #86〜#89 | メディアは Storage `board-media`(非公開・署名 URL) |
| 通知(アプリ内、ベル + 未読バッジ) | #90〜#91 | メール/プッシュ配信は無し |
| アクティビティログ(有料)+ feature_flag 基盤 | #92〜#93 | `hasFeature` / `requireFeature` / `FeatureLocked` |
| 道場ページ(公開)+ 未認証公開カレンダー + 設定画面 | #94〜#95 | `/d/<slug>` を認証状態で出し分け |
| 道場マスタ双方向書き込み | #96 | 共有 `public."DojoStyleMaster"` へ未承認追加 |
| アーカイブ(有料、階層 + 検索) | #97 | AikiNote 引用添付は将来 |
| 会計の見える化(有料、月謝 + 支出 + 収支グラフ) | #98 | 支出の編集 UI・CSV は未 |
| ボード Todo 管理(owner/admin 限定カンバン) | #99 | migration は `016` まで |

- テスト: backend 28 ファイル(うち RLS integration 5 本はローカル Supabase 必須・CI 除外)、frontend 24 ファイル。#99 時点のスタック先端で全 green を確認済み。
- インフラ: frontend = Vercel(`aiki-board.com`)、backend = Cloudflare Workers(`api.aiki-board.com`、main push で自動デプロイ)、DB/Auth = Supabase(AikiNote と同一プロジェクト・`aikiboard` スキーマ分離)。
- 未マージの open PR: dependabot 11 本のみ(#40, #56, #100〜#108。→ [R5-5](#r5-5-dependabot-滞留の解消))。

### 1.2 このドキュメントが生まれた経緯

2026-07-04 に docs 全体・全マージ済み PR 本文・コードベースを横断調査し、「実装済み機能の一覧」ではなく「**道場に使ってもらうために足りないもの**」の観点で棚卸しした結果をまとめた。調査で判明した主な事実:

1. **本番反映の記録が残っていなかった**: PR テンプレの「本番 migration 適用」チェックが `009`〜`016` で軒並み未チェックのままだった。**2026-07-04 にユーザー確認により、`009`〜`016` はすべて本番適用済みと判明**。以後は記録を恒久化する(→ R1-1)。
2. **権限マトリクスと実装の乖離**: 要件 3.2 の「オーナーのみ: アドミン任命・オーナー譲渡・ボード削除」に対応する **API/UI が存在しない**(`backend/src/routes/members/index.ts` にロール変更なし、`backend/src/routes/boards/index.ts` は GET/GET/POST のみ)。「IT に不慣れな道場長が事務局に運営を任せる」という中核ストーリーが現状成立しない(→ R2-1)。
3. **プラン定義の三つ巴の食い違い**: 要件 6.2(公開ページ・テーマは有料)/ migration `007` の seed(Free に `public_page`・`board_theme` を含む)/ プロダクト概要 7 章(Free は人数無制限、だが DB は free.member_limit=20)が互いに矛盾していた。**2026-07-04 にユーザーと協議のうえ確定**: 公開ページ = 有料 / テーマ = Free / Free 人数無制限・Mini 15 名 / カード不要の 60 日全機能トライアル(→ R6-0 / R6-2 に確定内容を記載)。
4. **ドキュメントの陳腐化**: README.md は「フィード以降は未実装」と実態と真逆の記述。requirements.md ヘッダは v1.6 のまま(履歴は v2.7 まである)。CLAUDE.md・development-guide.md(migration 000-010・23 テーブル表記)も古い(→ R0-1)。
5. **導入導線がプレースホルダ**: トップページ(`frontend/src/app/[locale]/(public)/page.tsx`)はタイトルとサブタイトルだけの仮ページ。OAuth なし・オンボーディングなし(→ R1-3, R3-1, R3-2)。

---

## 2. 本質的な見直し: 「作った」と「道場が使える」の間のギャップ

普及のボトルネックを「5 つの問い」に還元し、フェーズを導出した。

| # | 問い | 現状の答え | 対応フェーズ |
|---|---|---|---|
| 1 | **今日サインアップした道場長は、そもそも使えるか?** | ほぼ使える(migration 009〜016 は本番適用済みと確認)。残りはメール送信(Resend)と Dashboard 設定の確認 | **R1(P0)** |
| 2 | **道場の運営体制をそのまま持ち込めるか?** | 持ち込めない。アドミン任命ができず、やめる手段(ボード削除)もない | **R2** |
| 3 | **最初の 15 分で価値を感じ、仲間を呼べるか?** | 弱い。LP が仮、OAuth なし、空のボードに置き去り、招待の戻り導線なし | **R3** |
| 4 | **道場生(スマホ・非日本語話者含む)が毎日使えるか?** | 部分的。SP 未検証画面あり、言語切替 UI なし、PWA なし | **R4** |
| 5 | **信頼して預けられ、対価を払えるか?** | まだ。利用規約なし、レート制限なし、監視なし、決済なし | **R1/R5/R6** |

**優先度の定義**
- **P0**: これを済ませるまで道場に案内できない(リリースブロッカー)
- **P1**: 普及の主戦力。順に潰すことで「試した道場が定着する」確率が上がる
- **P2**: 磨き込み。要望・利用データを見て着手

**規模の定義**: S = PR 1 本・半日以内 / M = PR 1〜2 本・1〜2 日 / L = 複数 PR のスタック

---

## 3. タスク索引

| ID | タスク | 優先度 | 規模 | 依存 |
|---|---|---|---|---|
| [R0-1](#r0-1) | ドキュメント整合性の回復 | P0 | S | — |
| [R1-1](#r1-1) | 本番 Dashboard 設定の確認とチェックリスト恒久化 | P0 | S | ユーザー作業含む |
| [R1-2](#r1-2) | Resend ドメイン認証 + 実メール検証 | P0 | S | ユーザー作業 |
| [R1-3](#r1-3) | OAuth(Google / Apple)ログイン | P0 | M | ユーザー作業含む |
| [R1-4](#r1-4) | 利用規約・プライバシーポリシー | P0 | M | ユーザーレビュー必須 |
| [R2-1](#r2-1) | アドミン任命・解除(ロール変更) | P1(実質 P0) | M | — |
| [R2-2](#r2-2) | ボード削除(オーナー) | P1 | M | — |
| [R2-3](#r2-3) | オーナー譲渡 | P2 | S | R2-1 |
| [R2-4](#r2-4) | アカウント削除(AikiNote と要調整) | P2 | M | 方針決定 |
| [R3-1](#r3-1) | トップページ(LP)の本実装 | P1 | M | — |
| [R3-2](#r3-2) | オンボーディング(はじめの 3 ステップ + 空状態) | P1 | M | — |
| [R3-3](#r3-3) | 招待 QR コード | P1 | S | — |
| [R3-4](#r3-4) | `/invite` の return URL 保持 | P1 | S | — |
| [R3-5](#r3-5) | 公開ページの問い合わせ・見学申込フォーム | P1 | M | R5-1 推奨 |
| [R4-1](#r4-1) | SP 最適化スイープ(公開ページ・フィード・会計ほか) | P1 | M | — |
| [R4-2](#r4-2) | 言語切替 UI | P1 | S | — |
| [R4-3](#r4-3) | ヘッダーのダミー UI 整理(アカウントメニュー本実装) | P1 | S | — |
| [R4-4](#r4-4) | PWA 対応 | P1 | M | — |
| [R4-5](#r4-5) | プッシュ通知 | P2 | L | R4-4 |
| [R5-1](#r5-1) | レート制限 | P1 | M | 方針決定 |
| [R5-2](#r5-2) | アップロードのサーバ側サイズ検証 | P1 | S | — |
| [R5-3](#r5-3) | バックアップ・復旧方針の文書化 | P1 | S | ユーザー作業含む |
| [R5-4](#r5-4) | E2E スモークテスト | P1 | M | ADR 追補 |
| [R5-5](#r5-5) | dependabot 滞留の解消 | P1 | M | — |
| [R5-6](#r5-6) | 監視(Sentry / Axiom / Uptime / Umami) | P1 | M | **ユーザー明示指示が必要** |
| [R6-0](#r6-0) | カード不要の 60 日全機能トライアル(アプリ内実装) | P1 | M | — |
| [R6-1](#r6-1) | Stripe 決済(Checkout / Webhook / Portal) | P1 | L | 価格確定、R6-0 |
| [R6-2](#r6-2) | プラン定義の整合とプラン制限の enforcement(**確定済み**) | P1 | M | R6-0 と同時リリース |
| [R6-3](#r6-3) | 特定商取引法表記・価格確定 | P1 | S | R6-1 |
| [R7-*](#r7) | 磨き込みバックログ(P2 一覧) | P2 | — | — |

---

## 4. タスク詳細

### R0: ドキュメント整合性の回復

<a id="r0-1"></a>
#### R0-1. ドキュメント整合性の回復 — P0 / S

- **背景**: README.md が「フィード以降は未実装」と実態(全機能実装済み)と真逆の記述のまま放置されていた。新しい開発セッションや外部協力者が README を信じると誤った前提で作業する。実装とドキュメントのセット更新原則(`.agent/instructions.md` 5 章)の回復が目的。
- **現状**: 本書の導入 PR で `README.md`(ステータス + 実装状況セクション)と `CLAUDE.md` 冒頭 blockquote は是正済み。**残り**:
  - `docs/requirements.md` 冒頭ヘッダ: 「バージョン v1.6 / 最終更新 2026-06-04」のまま(改訂履歴は v2.7 / 2026-06-20 まで存在)。ステータス・バージョン・日付を v2.7 に同期。
  - `CLAUDE.md` 本文の「MVP 新規機能(ヒアリングで追加)」節: アーカイブ・会計を未来形で記述(実装済みに更新)。
  - `docs/development-guide.md`: 「マイグレーションを適用(000_seed + 001-010)」「aikiboard schema(23 テーブル)」(実際は `016` まで・テーブル増加済み)。
  - `docs/requirements.md` 9.2: デザインツールが Pencil のまま(実際は Claude Design に移行。正典は `docs/design/02_tokens.css` と `claude_design_prototype.tsx`)。
  - ADR 0001: 「スタック PR を squash マージすると後続 PR が連鎖コンフリクトするため、スタック運用時は merge commit で上から順にマージする(単発 PR は従来どおり squash)」の追補を 1 段落追加(#86〜#99 で実証済みの運用)。
- **実装方針**: 上記を現状(1.1 の表)に合わせて書き換える。実装状況の詳細は本書へのリンクに寄せ、二重管理を避ける。
- **受け入れ条件**: リポジトリ内のどのドキュメントを読んでも実装状況の記述が矛盾しない。「000-010」「23 テーブル」等の残骸ゼロ。
- **備考**: `.agent/instructions.md` は **git 管理外**(gitignore)。同ファイルの冒頭サマリ・「残り作業候補」ブロックの陳腐化も同時に直すが、PR には含まれない(ローカル編集)。

---

### R1: 本番リリースブロッカー(P0)

<a id="r1-1"></a>
#### R1-1. 本番 Dashboard 設定の確認とチェックリスト恒久化 — P0 / S(ユーザー作業含む)

- **背景**: migration の本番適用は Supabase Dashboard SQL Editor での手動運用(ADR 0004 D-12)だが、PR テンプレの適用チェックが `009`〜`016` で未チェックのままで**記録が残っていなかった**。**2026-07-04 にユーザー確認により `009`〜`016` はすべて本番適用済みと判明**(Storage バケット `board-media` も migration `014` 適用により作成済み)。残るのは記録の恒久化と Dashboard 側設定の確認。
- **実装方針**:
  1. Dashboard 設定の確認(**ユーザー作業**): Settings → API → **Exposed schemas に `aikiboard`** があるか / Settings → JWT Keys が **ES256(JWKS)** か(HS256 なら `wrangler secret put SUPABASE_JWT_SECRET` が必要。`backend/src/middleware/auth.ts` は alg 分岐で両対応)。※ 本番でログイン・ボード表示が現に動いているなら、いずれも設定済みの傍証。
  2. 本番の実機スモーク: フィード投稿(画像添付)・スレッド・通知ベル・Todo・公開ページを一巡して動作確認。
  3. `docs/development-guide.md` に「本番反映チェックリスト」節を追加し、**適用済み migration の台帳(`009`〜`016` = 適用済み、確認日 2026-07-04)** を記録。以後の機能 PR はマージ後にこの節へ追記する運用にする(`000_seed_*` は本番厳禁の注意書きも再掲)。
- **受け入れ条件**: development-guide に台帳があり、`016` までが適用済みと記録されている。本番スモークが通る。

<a id="r1-2"></a>
#### R1-2. Resend ドメイン認証 + 実メール検証 — P0 / S(ほぼユーザー作業)

- **背景**: お知らせの「メールでも通知」はプロダクト概要 3.3 で約束済みだが、本番は未認証ドメインのため実質送信不能(認証前は自分宛のみ)。道場長が最初に試す機能のひとつなので、静かに失敗すると信頼を失う。
- **現状**: 実装は完了(`backend/src/lib/announcement-email.ts`、Resend batch API を fetch 直叩き、`RESEND_API_KEY` 未設定時は警告ログでスキップ)。`wrangler.toml` の from は `noreply@aiki-board.com`。`.env.local.example` 42-45 行に手順メモあり。
- **実装方針(ユーザー作業)**: ① Resend で `aiki-board.com` を追加し、表示される SPF/DKIM レコードを Cloudflare DNS に登録 → 認証完了を確認。② API キーを発行し `cd backend && wrangler secret put RESEND_API_KEY`。③ 本番でお知らせを `notify_email` ON で公開し、受信・差出人・本文レンダリング(richtext→HTML)を確認。
- **受け入れ条件**: 本番ボードのメンバー宛にお知らせメールが届く。SPF/DKIM PASS。
- **備考**: コード変更ゼロの見込み。失敗時のみ `announcement-email.ts` のログを手がかりに調査。

<a id="r1-3"></a>
#### R1-3. OAuth(Google / Apple)ログイン — P0 / M(ユーザー作業含む)

- **背景**: 要件は「Apple/Google 優先、メール/パスワードはセカンダリ」(requirements 5.1)だが、実装は逆(メール/パスワードのみ)。ターゲットの道場長・高齢層メンバーにとって新規パスワード管理は最大級の離脱要因。AikiNote と共通アカウント基盤である以上、OAuth が揃って初めて「同じアカウントでそのまま」の約束が果たせる。
- **現状**: `frontend/src/app/[locale]/(public)/login/page.tsx`・`signup/page.tsx` はメール/パスワードのみ。Supabase Auth 自体は AikiNote と同一プロジェクトなので、**AikiNote 側で Google/Apple provider が設定済みの可能性が高い**(要確認。設定済みなら Dashboard 作業は redirect URL の追加のみ)。
- **実装方針**:
  1. **ユーザー確認**: Supabase Dashboard → Authentication → Providers で Google/Apple の有効状態を確認。Redirect URLs に `https://aiki-board.com/**`(と `http://localhost:3000/**`)を追加。
  2. frontend: ログイン/サインアップ画面に「Google で続ける」「Apple で続ける」ボタンを追加(`supabase.auth.signInWithOAuth({ provider, options: { redirectTo } })`)。コールバックは `/auth/callback` route handler で `exchangeCodeForSession` → `/home` へ。
  3. **`public."User"` 行の自動作成**: メール/パスワード登録は `POST /api/users`(`backend/src/routes/users/index.ts`)で行を作っている。OAuth 初回ログインでは行が無いため、`/home` リゾルバ(または AuthProvider)で「`users.get` が 404 なら `users.create` を呼ぶ」フォールバックを追加(username は email ローカル部などから初期生成し、後で変更可能に)。AikiNote 側で既に行があるユーザーはそのまま通る。
  4. ボタン文言は ja/en 両方追加。Apple はブランドガイドライン準拠の見た目にする。
- **受け入れ条件**: 新規 Google アカウントでサインアップ → ボード作成まで通しで動く。既存 AikiNote ユーザーが Google ログインで AikiBoard に入れる。メール/パスワードも引き続き動く。
- **備考**: Apple は Developer Program の Services ID 設定が必要(ユーザー作業)。**Google を先行**し、Apple は credentials が揃い次第でよい(2 段階に分割可)。

<a id="r1-4"></a>
#### R1-4. 利用規約・プライバシーポリシー — P0 / M(ユーザーレビュー必須)

- **背景**: プロダクト概要 9 章で「利用規約・プライバシーポリシーで明示します」と約束済み。道場の個人情報(氏名・メール・会費支払状況・子どもの写真や動画)を預かるサービスであり、規約なしで一般公開の招待はできない。道場長が導入を組織に諮る際の必須資料でもある。
- **現状**: 法務ページ・フッターリンクとも存在しない。
- **実装方針**:
  1. AikiNote に既存の規約があれば流用・姉妹サービス対応(要確認)。無ければドラフトを AI が作成し**必ずユーザーがレビュー・確定**する(勝手に公開しない)。要素: 会費情報等のセンシティブデータの扱い、メディア(未成年含む)の扱い、ボード削除・退会時のデータ削除、外部送信(Resend/Supabase/Vercel/Cloudflare)、準拠法。
  2. frontend: `(public)/terms` と `(public)/privacy` の静的ページ(Markdown ベタ打ちで可、和文先行・英文は R4-2 後)。サインアップ画面に「登録することで規約に同意」の文言 + リンク。公開ページ・LP のフッターにもリンク。
- **受け入れ条件**: 両ページが本番で閲覧でき、サインアップ導線から到達できる。文面はユーザー承認済み。

---

### R2: 道場の運営体制を成立させる(権限・ライフサイクル)

<a id="r2-1"></a>
#### R2-1. アドミン任命・解除(ロール変更) — P1(実質 P0)/ M

- **背景**: プロダクトの中核ストーリーは「IT に馴染みがない道場長でも、アドミン権限を持つ幹部・事務局に運営を任せられる」(プロダクト概要 3.4)。しかし**ロール変更 API が存在せず、招待で参加した人は全員 member のまま昇格できない**。つまり現在、アドミンになる方法がボード作成者(owner)以外に無い。要件 3.2 の権限マトリクス(アドミン任命はオーナーのみ)との明確な乖離。
- **現状**: `backend/src/routes/members/index.ts` は一覧 / admin 削除 / 自主退会のみ。`MembersView`(`frontend/src/components/features/members/`)にもロール UI なし。
- **実装方針**:
  1. backend: `PATCH /api/members/:id/role`(`:id` は `board_members` 行)。ミドルウェアは既存の `boardAccess` パターン(IdTable に `board_members` 追加)+ **owner 限定チェックをハンドラ内で実施**(既存 `boardAdminMiddleware` は admin も通すため、`c.get("memberRole") === "owner"` 相当の判定を追加。members route の削除処理に owner 保護の前例あり)。許可する遷移は `member ⇄ admin` のみ。owner への変更・owner の降格は 400(オーナー譲渡は R2-3)。
  2. `logActivity`(`backend/src/lib/activity.ts`)で「◯◯さんを管理者にしました」を記録。`notifyBoardMembers` は使わず**本人にのみ**アプリ内通知(`lib/notifications.ts` の `createNotifications` を単一宛先で)。
  3. frontend: `MembersView` の各行に owner だけに見えるメニュー(「管理者にする / 管理者を解除」)。確認ダイアログは共通 `Dialog`。tRPC は `members` router に procedure 追加(Hono 1:1 原則)。
  4. RLS: 書き込みは service_role 経由なので不要だが、`008_apply_rls.sql` の `board_members` UPDATE ポリシーが存在するなら owner 限定になっているか確認(なければ現状維持で可。backend が唯一の砦の原則)。
- **受け入れ条件**: owner が member を admin に昇格 → その人に Todo ナビ・お知らせ作成・メンバー承認等の管理 UI が現れる。admin は他人のロールを変更できない。activity ログに記録される。
- **備考**: テストは members route の既存テストパターン(role 別の 403 検証)を踏襲。

<a id="r2-2"></a>
#### R2-2. ボード削除(オーナー) — P1 / M

- **背景**: FAQ で「オーナーはボード自体を削除することで利用を終了できます」と約束済みだが未実装。**やめる手段が無いサービスは試されない**。試用→撤退→再挑戦のループを許容することが普及の前提。
- **現状**: `backend/src/routes/boards/index.ts` に DELETE なし。
- **実装方針**:
  1. backend: `DELETE /api/boards/:id`(owner 限定)。`aikiboard` スキーマの子テーブルは FK の `ON DELETE CASCADE` 定義を migration `002`〜`016` で確認し、CASCADE が無いテーブルは明示削除(退会処理 `cleanupMemberData` の前例に倣う)。**Storage の後始末**: `board-media` の `feed/<boardId>/` と `archive/<boardId>/` を `supabase.storage.from().list()/remove()` でループ削除(`lib/storage.ts` に `removeBoardMedia(boardId)` を追加)。
  2. frontend: `SettingsView` に「危険な操作」セクション(赤枠)。**ボード名の入力一致で確定**する確認ダイアログ(GitHub 方式)。削除後は `/home` へ(所属 0 件なら `/boards/new` に自動誘導される既存リゾルバに乗る)。
  3. 削除は物理削除で開始(soft delete はニーズが出てから)。実行前に「メンバー N 名・投稿 N 件が完全に削除されます」と集計表示。
- **受け入れ条件**: owner のみ削除でき、削除後に旧 `/d/<slug>` は公開ページにも出ず 404。Storage にファイルが残らない。admin/member には UI が見えない。

<a id="r2-3"></a>
#### R2-3. オーナー譲渡 — P2 / S(R2-1 の後)

- **背景**: 道場長の交代・世代交代は道場では普通に起きる。要件 3.2 でオーナー専権事項として定義済み。
- **実装方針**: `POST /api/boards/:id/transfer-ownership`(owner 限定、譲渡先は既存 admin のみに制限すると事故が減る)。単一 UPDATE 2 行(旧 owner→admin、新 admin→owner)を同一リクエスト内で実行し、失敗時はロールバック(Supabase REST はトランザクション不可のため、`rpc` 化するか、順序を「先に昇格 → 後に降格」とし途中失敗でも owner 2 名を経由して owner 0 名を作らない)。確認ダイアログ + 譲渡先へ通知。
- **受け入れ条件**: 譲渡後、旧オーナーは admin として操作継続でき、課金責任(R6 実装後は Stripe customer)の扱いがドキュメント化されている。

<a id="r2-4"></a>
#### R2-4. アカウント削除 — P2 / M(方針決定が先)

- **背景**: プライバシー上の当然の権利で、将来のネイティブアプリ審査(App Store)でも必須要件。
- **現状**: `backend/src/routes/users/index.ts` は作成と取得のみ。**`public."User"` は AikiNote と共有**のため、AikiBoard 単独で削除方針を決められない。
- **実装方針**: まず方針決定(ユーザー + AikiNote 側と): Auth ユーザー削除 = 両サービス退会とするか。実装は「AikiBoard 固有データの削除(全ボードからの退会 + owner ボードの扱い)→ AikiNote 側の削除フローへ誘導」の段階式を推奨。owner のままのボードがある場合は削除か譲渡を先に求める。
- **受け入れ条件**: 方針が requirements.md に明文化され、その通りに動く。

---

### R3: 導入体験 — 集客から定着まで

<a id="r3-1"></a>
#### R3-1. トップページ(LP)の本実装 — P1 / M

- **背景**: 現状の `aiki-board.com` はタイトル + サブタイトル + フェーズ表記だけの仮ページ(`frontend/src/app/[locale]/(public)/page.tsx`)。道場長が URL を開いた 10 秒で「自分の道場の課題を解決するものだ」と分からなければ、そこで終わる。公開ページ(SEO)から流入した見学希望者・他道場の指導者の受け皿でもある。
- **実装方針**:
  1. 構成は `docs/aikiboard-product-overview.md` を単一ソースに: ヒーロー(「道場の運営を、もっと軽やかに。」+ CTA「無料で道場ボードを作る」)→ 「こんな悩みありませんか」(概要 1 章)→ 主要機能 6 枠(カレンダー/お知らせ/フィード/会計/アーカイブ/公開ページ、PhosphorIcons)→ AikiNote 連携 → 料金 3 プラン(概要 7 章。※価格は「予定」表記、R6-3 で確定)→ FAQ 抜粋 → フッター(規約/プライバシー/AikiNote リンク)。
  2. デザインは `docs/design/02_tokens.css` のトークン(墨 `#2C2C2C`・銅 `#C4956A`・和紙 `#F5F3EF`、Zen Old Mincho 見出し)を CSS Modules で。スクリーンショットは実画面(seed データ)を撮って `public/` に置く。
  3. `generateMetadata` で OGP/description を整備(公開ページ #95 の前例を踏襲)。SP ファースト(道場長もスマホで最初に開く)。
  4. ログイン済みユーザーがトップに来たら `/home` へリダイレクト(既存の認証判定を再利用)。
- **受け入れ条件**: 未ログインで開くと価値提案 → サインアップまで迷わず進める。Lighthouse の SEO/a11y が実用水準。ja/en 両対応。

<a id="r3-2"></a>
#### R3-2. オンボーディング(はじめの 3 ステップ + 空状態) — P1 / M

- **背景**: ボード作成直後のホームは空のカードが並ぶだけで、次に何をすべきか示されない。「最初の 15 分」で稽古予定が入り招待リンクが飛ぶところまで導ければ、定着率は大きく変わる。
- **実装方針**:
  1. ダッシュボード(`DashboardCards` 周辺)に owner/admin 向け「はじめの 3 ステップ」カードを追加: ① 稽古スケジュールを登録(→ `/d/<slug>/calendar`)② 招待リンクを発行して仲間に共有(→ `/d/<slug>/members`)③ 最初のお知らせを投稿(→ `/d/<slug>/announce`)。達成判定は既存 API の件数で自動(events ≥1 / invitations ≥1 / announcements ≥1)。全達成で非表示(dismiss も可、`board_settings` かローカルストレージに保持)。
  2. 各機能の空状態文言を「データがありません」型から**行動誘導型**へ書き換え(例: フィード「最初の投稿をしてみましょう。稽古の感想でも写真 1 枚でも」+ 投稿ボタン)。対象: フィード / お知らせ / カレンダー / メンバー / アーカイブ / 会計 / Todo。
  3. 新規実装は極力せず、既存 View の empty 分岐の文言 + CTA ボタン追加に留める。
- **受け入れ条件**: 新規ボード作成 → ホームに 3 ステップが出る → 3 つ完了で消える。全空状態に次の一歩の CTA がある。

<a id="r3-3"></a>
#### R3-3. 招待 QR コード — P1 / S

- **背景**: 道場文化への適合。稽古後に「このQRを読んで」が最速の招待動線で、道場の物理掲示板に貼れる。プロダクト概要 2 章で「招待リンクや QR コード」と約束済み。
- **現状**: 共有リンク(`/invite/<token>`)は実装済み(`InviteLinkPanel`)。QR は migration `012` のコメントに構想のみ。
- **実装方針**: クライアント側のみで完結。軽量ライブラリ 1 つ(`qrcode` npm、canvas/SVG 生成)を frontend に追加し、`InviteLinkPanel` に「QR を表示」ボタン → 共通 `Dialog` に QR + ボード名 + 有効期限を印刷向けレイアウトで表示(`@media print` で余白調整)。PNG ダウンロードボタン(canvas→dataURL)。backend 変更なし。
- **受け入れ条件**: 発行済みリンクの QR をスマホで読むと `/invite/<token>` が開く。印刷して A4 貼り紙にできる。

<a id="r3-4"></a>
#### R3-4. `/invite` の return URL 保持 — P1 / S

- **背景**: 招待リンクを受け取った未登録者は、ログイン/サインアップ後に**招待に戻れず `/home`(所属 0 なら `/boards/new`)へ落ちる**。招待された人がボード作成画面に誘導されるのは体験として最悪で、道場生の離脱ポイント。R3-3(QR)をやるほど、この穴の被害が拡大する。
- **実装方針**: `/invite/<token>` で未認証なら `/login?returnTo=/invite/<token>` へ(サインアップへの切替リンクにも `returnTo` を伝播)。認証完了後、`returnTo` が**相対パスかつ `/invite/` 始まりの場合のみ**リダイレクト(open redirect 防止のホワイトリスト方式)。実装位置: login/signup ページの成功ハンドラ + `(public)` レイアウトの認証済みリダイレクト処理。OAuth(R1-3)導入時は `signInWithOAuth` の `redirectTo` にも同じ `returnTo` を載せる。
- **受け入れ条件**: 未登録者が招待リンク → サインアップ → メール確認(あれば)→ 自動で招待受諾画面に戻り参加完了、が通しで動く。外部 URL を `returnTo` に入れても飛ばない。

<a id="r3-5"></a>
#### R3-5. 公開ページの問い合わせ・見学申込フォーム — P1 / M(R5-1 と同時が望ましい)

- **背景**: 公開ページは「集客チャネル」という戦略的位置づけ(requirements 2 章)だが、現状は連絡先の**表示のみ**で、見学希望者が踏めるアクションが無い。「問い合わせフォーム / 見学申し込み導線」はプロダクト概要 5 章の約束。入門希望者 1 人の獲得は道場にとって月謝数千円 × 年単位の価値であり、これが決まれば有料プランの説得力が跳ね上がる。
- **実装方針**:
  1. migration `0XX_create_inquiries.sql`(番号は着手時の次の空き連番): `aikiboard.inquiries`(board_id, name, email, message ≤1000, kind: `inquiry`/`trial_visit`, created_at, handled_at)。RLS は管理者のみ SELECT/UPDATE(`is_admin_or_owner_of_board` ヘルパ再利用)。
  2. backend: `routes/public` に `POST /api/public/boards/:slug/inquiries`(anon、`is_public=true` かつ設定で受付 ON のボードのみ)。**スパム対策 3 層**: honeypot フィールド / 最小送信間隔(同一 IP、R5-1 のレート制限)/ 本文長・件数上限(1 ボード 1 日 N 件で自動クローズ)。管理者へアプリ内通知(`notifyBoardMembers` を admin 限定に絞る改修 or 個別 `createNotifications`)+ Resend でメール転送(R1-2 完了後)。
  3. frontend: `PublicBoardView` にフォーム(名前/メール/種別/本文)。管理側は `SettingsView` に受付 ON/OFF、通知はベルに載る。返信は当面メーラー起動(`mailto:`)でよい(CRM 化しない)。
- **受け入れ条件**: 未ログインの見学希望者が公開ページから送信 → owner/admin に通知が届き、一覧で確認できる。スパム 3 層が効いている。
- **備考**: 「問い合わせ一覧画面」を作るか通知どまりにするかは着手時に規模で判断(最小は members 画面の申請パネルと同型の簡易パネル)。

<a id="r3-6"></a>
#### R3-6. AikiNote 側の参加申請導線 — (別リポジトリ・Issue 化済み)

- AikiNote に「所属道場のボードを見つけて参加申請」する UI を新設し、`api.aiki-board.com` の `discoverable`/`mine`/`create` を呼ぶ(v1.9 の導線分担)。本リポジトリ側は承認 UI 実装済みで**待ち状態**。aikinote リポジトリ作業のため本書では追跡のみ。

---

### R4: 毎日使える体験(スマホ・言語・PWA)

<a id="r4-1"></a>
#### R4-1. SP 最適化スイープ — P1 / M

- **背景**: メンバー(道場生)はほぼスマホ。管理者も出先ではスマホ。`@media` 対応済み画面(シェル/カレンダー/お知らせ/Dialog 等)と未対応画面が混在しており、**特に公開ページ(集客の入口、SP 流入が最多のはず)が未対応**なのは優先度が高い。
- **現状**: `@media` 未定義の主な CSS Modules: `PublicBoardView` / `PublicCalendar`(公開ページ)、`FeedView` / `PostCard` / `PostComposer`(フィード)、`FinanceView`(会計、表が多く崩れやすい)、`MembersView` / `InviteLinkPanel` / `InviteJoin` / `PendingRequestsPanel`(メンバー系)。フォーム類は共通 `Dialog` のシート化に救われている可能性があるため要実機確認。
- **実装方針**: 確立済みの方針(requirements / 実装メモ)を踏襲 — **ブレークポイントは mobile 〜639px、`@media` 内に SP 差分を隔離して PC には一切影響を与えない**。外側余白は共通シェル `.content` が一括で持つため**各 View に外側 padding を足さない**(過去の張り付き不具合の再発防止)。作業手順: ① iPhone SE 幅(375px)で全画面をスクリーンショット巡回し崩れを台帳化 → ② 公開ページ → フィード → 会計 → メンバー系の順に修正 → ③ 巡回結果を PR に添付。表(会計)は横スクロールコンテナ化 or カード積み替え。
- **受け入れ条件**: 375px 幅で全画面が横スクロールなしで操作でき、PC 表示に差分がない(スクリーンショット比較)。

<a id="r4-2"></a>
#### R4-2. 言語切替 UI — P1 / S

- **背景**: 翻訳は ja/en とも 493 行・完訳済みなのに、**切り替える UI が無く**(`BoardHeader` の Globe はダミー)、`localeDetection: false` のため英語話者は永遠に日本語を見る。USAF 等の英語圏道場を掲げる以上、切替 1 個で既存資産が全部生きる。
- **実装方針**: `BoardHeader` の Globe ボタンを本実装: ドロップダウンで 日本語/English → `next-intl` の `usePathname`/`useRouter`(`lib/i18n/routing`)で同一パスの locale 差し替え遷移 + cookie(`NEXT_LOCALE`)保存。`(public)` レイアウト(LP・ログイン・公開ページ)にも同じ切替を配置(公開ページは海外からの閲覧が起きうる)。
- **受け入れ条件**: どの画面からも 2 タップで言語が切り替わり、リロード後も維持される。

<a id="r4-3"></a>
#### R4-3. ヘッダーのダミー UI 整理 — P1 / S

- **背景**: `BoardHeader` の検索(⌘K)・アカウントボタンは**押しても何も起きないダミー**(`BoardHeader.tsx:26` のコメント参照)。動かないボタンは「未完成のサービス」という印象を与え、信頼を削る。
- **実装方針**: アカウントボタンは**本実装**: ドロップダウン(ユーザー名/メール表示・言語切替 R4-2 と統合可・ログアウト)。プロフィール編集画面は持たない(段級位等のプロフィールは AikiNote 側の領分。リンクを置くに留める)。検索(⌘K)は**当面非表示**にする(グローバル検索は R7 のバックログへ。ダミーで置いておく価値が無い)。
- **受け入れ条件**: ヘッダーに押して無反応の要素が存在しない。

<a id="r4-4"></a>
#### R4-4. PWA 対応 — P1 / M

- **背景**: 「ホーム画面に追加するとアプリのように開ける」はプロダクト概要 8 章の約束で、ネイティブアプリ(Phase 2、AikiNote 同様の WebView ハイブリッド)への布石。道場生の日常導線は LINE と同じ「ホーム画面のアイコン」。
- **現状**: `frontend/public/` は空。manifest / Service Worker / アイコンなし。
- **実装方針**:
  1. `manifest.webmanifest`(name/short_name/theme_color= 墨 `#2C2C2C`/background= 和紙/display: standalone/start_url: `/home`)+ アイコン一式(512/192/maskable/apple-touch-icon)。Next.js の Metadata API(`app` の `manifest` エクスポート)で配線。
  2. Service Worker は**最小構成を手書き**(next-pwa は Next 16 での保守状況に依存するため避ける): インストール時にアプリシェルのみ precache、fetch はネットワーク優先・オフライン時はフォールバックページ。**データのオフラインキャッシュはしない**(会費・メンバー情報を端末に残さない方が安全)。
  3. iOS Safari 向け「ホーム画面に追加」の案内バナー(初回のみ・dismiss 可)。
- **受け入れ条件**: Lighthouse PWA installable 判定パス。iOS/Android でホーム追加 → standalone 起動 → ログイン維持。
- **備考**: standalone 表示での `location` 遷移の作法(外部リダイレクトは `location.replace`)は AikiNote の既存知見に従う。

<a id="r4-5"></a>
#### R4-5. プッシュ通知 — P2 / L(R4-4 の後)

- Web Push(VAPID)+ 通知テーブルへの配信フック + ユーザーごとの通知設定(ON/OFF、種別)。iOS は PWA インストール済みが前提。アプリ内通知(`lib/notifications.ts`)の発火点に配信レイヤを足す設計になるため、通知設定テーブルの migration を伴う。**着手は利用道場が付いてから**で十分。

---

### R5: 信頼と運用基盤

<a id="r5-1"></a>
#### R5-1. レート制限 — P1 / M(方針決定が先)

- **背景**: 認証・招待トークン検証・メール送信・署名 URL 発行・公開 API(R3-5 のフォーム含む)が**すべて無制限**。攻撃だけでなく、善意の異常(スクリプト誤爆)でも Resend 課金や Storage 汚染が起きうる。
- **実装方針(推奨: 2 層)**:
  1. **Cloudflare 側(主戦力・コード不要)**: `api.aiki-board.com` ゾーンに Rate Limiting Rules を設定(例: `/api/*` 全体で IP あたり 300req/min、`/api/public/*` と認証系はより厳しく 30req/min)。**ユーザーの Dashboard 作業**。設定内容を development-guide に記録。
  2. **アプリ側(急所のみ)**: Workers KV や Durable Objects を増やさず、`board_posts` 添付 URL 発行・問い合わせ POST・招待参加に「同一ユーザー/IP の直近 N 分間の件数を DB カウントで検査」する軽量ガードをハンドラ内に実装(厳密さより上限の存在が重要)。
- **受け入れ条件**: 連続大量リクエストが 429 で頭打ちになる。正常利用(道場 40 人が稽古後に一斉アクセス)は影響を受けない閾値であること。

<a id="r5-2"></a>
#### R5-2. アップロードのサーバ側サイズ検証 — P1 / S

- **背景**: 現状のサイズ検証はフロント(`frontend/src/lib/feed/uploadAttachment.ts` の `MAX_FILE_BYTES=100MB`)と Storage バケット定義(`014`、100MB)のみで、**署名 URL 発行時にサーバは content-type しか見ていない**。バケット上限が最後の砦として機能しているため緊急度は中だが、動画 100MB を「フィード添付の既定上限」として妥当か含め整理する。
- **実装方針**: 署名 URL 発行 API(`routes/board-posts` / `routes/archives` の upload-url 系)に `fileSize` 申告を必須化し、種別ごとの上限(画像 10MB / 動画 100MB 等)を backend 定数で検証。将来 Stripe 導入後にプラン別上限へ拡張できるよう定数を `lib/storage.ts` に集約。
- **受け入れ条件**: 上限超の申告は 400。フロントのチェックを外して直接叩いても防がれる(バケット上限に到達する前に拒否)。

<a id="r5-3"></a>
#### R5-3. バックアップ・復旧方針の文書化 — P1 / S(ユーザー作業含む)

- **背景**: 「道場の記憶を残す」(アーカイブ)を売りにする以上、消えたら終わり。現状、バックアップへの言及がリポジトリに一切ない。
- **実装方針**: ① Supabase プロジェクトのバックアップ設定(プラン付帯の日次バックアップ / PITR の有無)を Dashboard で確認(**ユーザー作業**)。② Storage(`board-media`)はバックアップ対象外になりがちなので方針を決める(当面「Supabase の冗長性に依存、追加バックアップなし」と明示するだけでも可)。③ 復旧手順(誰が・どこから・何分で)を development-guide に 1 節追加。
- **受け入れ条件**: 「DB が飛んだら何をするか」に document で答えられる。

<a id="r5-4"></a>
#### R5-4. E2E スモークテスト — P1 / M(ADR 追補が前提)

- **背景**: 機能数が 14 を超え、リグレッションの検知が単体テストと手動確認頼み。特にルーティング(`/d/<slug>` の公開/会員出し分け)と認証周りは壊れても単体では気づけない。ADR 0003 C-8 は「E2E はスコープ外」としているため、**ADR に追補してから**導入する(ルール上の整合)。
- **実装方針**: Playwright を frontend devDependency に追加し、**1 本のスモークシナリオに限定**: サインアップ → ボード作成 → 稽古登録 → 招待リンク発行 → (別コンテキストで)招待参加 → 出欠表明 → お知らせ公開 → 通知確認。ローカル Supabase 必須のため CI では実行せず、`pnpm test:e2e` の手動/pre-release 実行から始める(nightly 化は後日)。シナリオ肥大は禁止(スモーク 1 本主義。網羅は単体テストの領分)。
- **受け入れ条件**: `pnpm test:e2e` がローカルで green。ADR 0003 に追補が入っている。

<a id="r5-5"></a>
#### R5-5. dependabot 滞留の解消 — P1 / M

- **背景**: open PR 11 本が滞留中。放置するほど差分が積もり、セキュリティパッチも遅れる。
- **現状と対応順**:
  1. **#100(npm minor/patch 34 件)**: 最優先で取り込み。ただし `@supabase/ssr 0.7→0.12` は 0.x 帯で幅が大きく、認証(cookie 処理)に直結するため**ローカルでログイン/セッション維持を必ず手動確認**。
  2. **#56(GitHub Actions 6 件)**: checkout v7 等メジャー跳躍だが CI 専用でアプリ無関係。CI が green ならマージ。
  3. **Storybook 系 #103/#106/#107(9→10)** と **Vite 系 #104/#108** はそれぞれ連動セットで 1 本ずつ検証。
  4. **#40(TS 5→6)/ #101(@types/node 22→26)/ #102(vitest 3→4)/ #105(happy-dom 18→20)**: 単独で順次。TS 6 は型エラーの洗い出しが必要なので最後尾でよい。
- **受け入れ条件**: dependabot open PR が 0(クローズ判断含む)。各マージ後に `pnpm check && pnpm test && pnpm -r build` green。

<a id="r5-6"></a>
#### R5-6. 監視・分析(Sentry / Axiom / BetterStack / Umami) — P1 / M(**ユーザーの明示指示が必要**)

- **背景**: 本番エラーは現状 Cloudflare の observability ログを見に行かない限り誰も気づけない。道場に使ってもらい始めるなら「壊れたら 5 分で気づける」状態が先。requirements 10 章で選定済み(Sentry=エラー / Axiom=ログ / BetterStack=稼働 / Umami=分析)。
- **実装方針**: `backend/src/lib/logger.ts` は emit() 差し替え前提で設計済み(ADR 0003 C-10)。① Axiom: logger の emit を fetch 送信に差し替え(Workers 互換)。② Sentry: frontend は `@sentry/nextjs`、backend は Workers 用 SDK か logger 経由のエラー転送。③ BetterStack: `https://aiki-board.com` と `https://api.aiki-board.com/health` の外形監視(Dashboard 設定のみ)。④ Umami: script タグ 1 行(AikiNote と同じダッシュボード)。
- **備考**: 運用ルール(instructions.md)で「監視・分析はユーザーの明示的な指示がある場合のみ導入」と定められているため、**着手前に必ずユーザー承認を取る**。外部サービス契約・API キー発行はユーザー作業。

---

### R6: 収益化(Stripe)とプラン整合

> **2026-07-04 確定(ユーザー協議済み)**: 公開ページは**有料機能**とする。ただし**カード登録不要の 60 日全機能トライアル**(Standard 相当)を全新規ボードに付与し、無料で試せるようにする。テーマカラーは Free に残す。人数は Free 無制限・**Mini のみ 15 名上限**・Standard 無制限。

<a id="r6-0"></a>
#### R6-0. カード不要の 60 日全機能トライアル(アプリ内実装) — P1 / M(Stripe 非依存、R6-2 と同時リリース必須)

- **背景**: 公開ページを有料機能とする決定により、Free は純粋な内部運営ツールになり、道場が有料価値(公開ページ・会計・アーカイブ)を実感する経路は**トライアルだけ**になる。Stripe(R6-1)の完成を待たずに本番の道場へ全機能を体験してもらうため、カード登録不要のトライアルをアプリ内で先行実装する。IT に不慣れな道場長にとって「カード入力なしで始められる」ことは心理障壁の最小化でもある。
- **決定事項(2026-07-04)**: 期間 **60 日** / 範囲は**全有料機能(Standard 相当)** / **カード登録不要** / 期限切れで Free に自動ダウングレード(**データは消さない**)。
- **現状**: `POST /api/boards`(`backend/src/routes/boards/index.ts` の subscription 自動生成部)はボード作成時に Free(status: active)の `board_subscriptions` を生成。`lib/features.ts` は status が `trialing/active/past_due` の契約を有効扱いするが、**`trial_ends_at` の期限判定はしていない**。
- **実装方針**:
  1. ボード作成時の subscription 生成を「Standard / status=`trialing` / `trial_ends_at` = now + 60 日」に変更。**トライアルは owner 1 人につき 1 回**(過去に `trialing` 契約を持った owner の新規ボードは Free で開始。`board_subscriptions` × `board_members(owner)` の履歴で判定し、作り直しによる再トライアルを防ぐ)。
  2. `lib/features.ts` に期限判定を追加: `status='trialing' AND trial_ends_at < now()` は Free 扱い(読み取り時のフェイルセーフ判定。DB 更新バッチ/cron は持たない)。
  3. 期限の可視化: 設定画面 + ダッシュボードに「トライアル残り N 日」表示(`BoardDetail` に trial 情報を追加)。期限切れ後の `FeatureLocked` に「**データは消えていません**。プラン契約で再開できます」の文言。
  4. 公開ページの期限切れ挙動: `routes/public` の anon API に `hasFeature(boardId, "public_page")` 判定を追加(期限切れ = 非公開扱い)。`board-settings` の公開設定保存にも `requireFeature("public_page")`(テーマは Free 確定のため対象外)。
  5. 既存の本番ボードへの経過措置: リリース時点で存在するボードには「**リリース日 + 60 日**」でトライアルを付与(作成日起点にしない)。
- **受け入れ条件**: 新規ボードが 60 日間フル機能で使え、61 日目に公開ページが非公開・有料機能がロックされ、データは保持される。同一 owner の 2 枚目ボードにトライアルが付かない。残り日数が UI で分かる。
- **備考**: R6-2(公開ページの有料化 = seed 修正)と**同一リリース**にすること(トライアルなしで有料化すると、Stripe 完成まで誰も公開ページを使えなくなる)。また、**R6-0/R6-2 リリースから 60 日以内に R6-1(Stripe)を届ける**こと(最初のトライアル満了道場が支払い手段のないままロックされるのを防ぐ)。

<a id="r6-1"></a>
#### R6-1. Stripe 決済 — P1 / L(価格確定 R6-3 と R6-0 が前提)

- **背景**: 有料機能(公開ページ/アーカイブ/会計/アクティビティログ)は実装済みだが、決済が無いため対価を受け取れない。**R6-0 のトライアル満了道場が現れる前(R6-0/R6-2 リリースから 60 日以内)に本タスクを届ける**ことで、公開ページ有料化の商流が閉じる。
- **現状**: DB は受け入れ準備済み — `plans.stripe_product_id` / `board_subscriptions.stripe_subscription_id`・`stripe_customer_id`・`status(trialing/active/past_due/canceled)`・`trial_ends_at`・`current_period_end`(migration `007`)。Stripe SDK・Webhook・Checkout・プラン変更 UI は皆無。
- **実装方針**(スタック PR 3〜4 本):
  1. **backend #1**: `stripe` npm(Workers では `Stripe.createFetchHttpClient()` + `SubtleCryptoProvider` を使用)。`routes/billing`: `POST /checkout-session`(owner 限定、`mode: subscription`、成功/キャンセル URL は settings 画面。**`trial_period_days` は付けない** — トライアルは R6-0 のアプリ内実装が正であり、二重トライアルを防ぐ)・`POST /portal-session`(Customer Portal でプラン変更・解約・請求書を丸投げし、自前 UI を最小化)。
  2. **backend #2**: `POST /api/billing/webhook`(署名検証は `constructEventAsync`。**authMiddleware なし・専用パス**)。処理イベント: `checkout.session.completed` / `customer.subscription.updated` / `customer.subscription.deleted` → `board_subscriptions` を upsert(plan は price ID→`plans` 逆引き)。冪等性は event id 記録で担保。
  3. **frontend**: `SettingsView` に「プラン」セクション(現在プラン表示 / アップグレード → Checkout / 管理 → Portal)。`FeatureLocked` の CTA をこの画面へのリンクに差し替え。
  4. **Stripe ダッシュボード(ユーザー作業)**: Product/Price 作成(月・年 × Mini/Standard)、Customer Portal 設定、Webhook エンドポイント登録、`wrangler secret put STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET`。Stripe Invoice(請求書払い)は Portal/Checkout の標準機能で賄えるため独自実装しない。
- **受け入れ条件**: テストモードで Free→Standard アップグレード → 有料機能が即時解放 → 解約 → 期間満了で Free に戻る、が Webhook 経由で自動反映される。トライアル済み/中のボードが契約すると `trialing` から `active` に引き継がれ、追加トライアルは付かない。
- **備考**: 支払いはオーナー 1 名代表(概要 7 章)。owner 以外には課金 UI を出さない。

<a id="r6-2"></a>
#### R6-2. プラン定義の整合とプラン制限の enforcement — P1 / M(**2026-07-04 確定済み**、R6-0 と同時リリース)

- **背景**: 調査で判明したプラン定義の食い違い(要件 6.2 / migration `007` seed / プロダクト概要 7 章)について、2026-07-04 にユーザーと協議のうえ以下に**確定**した。
- **確定したプラン定義**:

  | 項目 | Free | Mini(¥630/月・仮) | Standard(¥980/月・仮) |
  |---|---|---|---|
  | メンバー人数 | **無制限** | **15 名まで** | 無制限 |
  | カレンダー/出欠/お知らせ/フィード/メンバー管理/Todo | ○ | ○ | ○ |
  | ロゴ・テーマカラー(`board_theme`) | **○(Free に確定)** | ○ | ○ |
  | 公開ページ(`public_page`) | **✕(有料に確定)** | ○ | ○ |
  | アーカイブ / 会計 / アクティビティログ / マルチボード | ✕ | ○ | ○ |

  - 全新規ボードに **60 日フルトライアル**(R6-0)が付くため、どの道場も公開ページ含む全機能を無料で試したうえで契約を判断できる。
  - 現状の seed との差分: `plan_features` から free × `public_page` を除外(`board_theme` は現 seed どおり Free 維持)、`plans` を free.member_limit=NULL・mini.member_limit=**15**(現 20)に修正。
- **実装方針**:
  1. migration(次の空き連番)で seed 修正: `DELETE FROM plan_features WHERE plan=free AND feature=public_page` / `UPDATE plans SET member_limit = NULL WHERE code='free'` / `UPDATE plans SET member_limit = 15 WHERE code='mini'`(forward-only)。
  2. ドキュメント同期: 要件 6.2(`board_theme` を Free 側へ移動、公開ページ有料 + 60 日トライアルを明記)・6.3(トライアルを「30 日・Stripe」から「60 日・カード不要・アプリ内」へ改訂)・プロダクト概要 7 章(人数・トライアル・公開ページ)を同時改訂。
  3. enforcement:
     - `member_limit`: 招待参加(`/invite/<token>` の参加処理)と参加申請の承認時に、契約プランの `member_limit` と現メンバー数を突き合わせ、超過なら「プラン上限に達しています」エラー。ダウングレード等で既に超過しているボードは「追加だけ不可」(既存メンバーは維持)。
     - `multi_board`: `POST /api/boards` で owner として 2 枚目以降を作る場合に `hasFeature` 判定(無ければ 403 `feature_locked`)。トライアル中は通る。
     - `public_page`: R6-0 の実装方針 4(公開 API + board-settings のゲート)で対応。
  4. **既存ボードの既得権**: enforcement は「新規作成・新規参加」のみに適用し、既存データは遡って壊さない。この方針を requirements に明記。
- **受け入れ条件**: 要件 6.2・概要 7 章・DB seed・実装の 4 者が一致。Mini ボードは 16 人目の参加がブロックされ、トライアル切れの Free ボードは公開ページが非公開になり、契約(R6-1 実装後)で即時解放される。

<a id="r6-3"></a>
#### R6-3. 特定商取引法表記・価格確定 — P1 / S(ユーザー作業中心)

- 有料販売開始には特商法に基づく表記(事業者名・連絡先・返金規定等)が必須。`(public)/tokushoho` 静的ページ + フッターリンク。価格(現行仮: Mini ¥630/月・Standard ¥980/月)と年額の最終確定はユーザー(トライアル条件は「60 日・カード不要・全機能」で確定済み)。R1-4(規約)と同一 PR で扱ってよい。

---

<a id="r7"></a>
### R7: 磨き込みバックログ(P2 — 要望・利用データを見て着手)

優先順は暫定。着手時に本書へ昇格させ、詳細フォーマット(背景/現状/方針/受け入れ条件)に展開すること。

| 項目 | メモ |
|---|---|
| 出欠集計ダッシュボード(稽古横断) | 概要 3.2 が約束する「継続参加の状況俯瞰」。現状はイベント単位の名簿のみ(`GET /api/events/:id/rsvps`)。月次の参加率・メンバー別出席傾向を管理者ホームに |
| 会計: 支出の編集 UI・CSV エクスポート | 編集 API は実装済みで UI が無い(#98 残)。CSV は道場総会の会計報告資料に直結し実用価値が高い |
| カレンダー週表示・リスト表示 | `CalendarMonth.tsx:161,169` で disabled のまま |
| アーカイブ: AikiNote 引用添付・添付差し替え・並べ替え | `aikinote_page` 型の列は確保済み(#97 残) |
| Todo: D&D 並べ替え・担当者への通知 | `order_index` 列は確保済み(#99 残) |
| メンバー停止(suspend) | 現状は削除のみ。休会者の扱いに需要が出たら |
| 通知の深いリンク(`?open=<id>`)・種別ミュート | #90/#91 残。通知が増えるほど効く |
| メール通知の拡張(フィード・申請などのダイジェスト) | 現状メールはお知らせのみ。LINE 代替を狙うなら週次ダイジェストが有力 |
| 定期シリーズの日時一括変更 | 現状は「この回だけ編集」or 作り直し(#65 残) |
| 国際タイムゾーン対応 | Asia/Tokyo 壁時計固定。英語圏道場の獲得を本格化する際の前提 |
| グローバル検索(⌘K) | R4-3 で一旦非表示にした機能の本実装(お知らせ・フィード・アーカイブ横断) |
| メンバープロフィール表示の拡充 | 概要 4.4(段級位・自己紹介)。データは AikiNote 側 `public."User"` にあり、表示の充実のみ |
| Storybook 拡充 / Visual Regression | データ取得連動コンポーネントの story が未整備 |
| ネイティブアプリ(Expo WebView) | Phase 2。AikiNote native の WebView ハイブリッド方式を踏襲 |

---

## 5. 進め方の規約(要点の再掲 — 着手前に必読)

実装規約の正は `docs/adr/` と `CLAUDE.md` だが、後続セッションが踏み外しやすい要点のみ再掲する。

1. **PR 運用**: main 直 push 禁止。単発 PR は squash マージ。**スタック PR は squash すると後続が連鎖コンフリクトするため、上から順に merge commit でマージする**(#88〜#99 の実証済み運用。R0-1 で ADR 追補)。ブランチは `feat/...`・`docs/...` 等、コミットは prefix(feat/fix/chore/test/docs)以外日本語。Issue 起票はユーザーが行う(Claude は PR まで)。
2. **認可の原則**: backend は service_role(RLS バイパス)なので、**`middleware/boardAccess.ts` 系ミドルウェアが唯一の砦**。新規リソースは IdTable への追加 + member/admin ミドルウェアの適用を忘れない。RLS は anon 直アクセス用の防御層として必ず併設(`ENABLE ROW LEVEL SECURITY` + `is_member_of_board`/`is_admin_or_owner_of_board` ヘルパ)。
3. **migration**: `backend/src/migrations/` に 3 桁連番(次は `017`)。forward-only(down を書かない)。本番適用は Dashboard SQL Editor 手動 + R1-1 のチェックリストに記録。`000_seed_*` は本番厳禁。
4. **API 設計**: tRPC procedure ↔ Hono endpoint は 1:1。フロントは vanilla tRPC client を React Query の queryFn/mutationFn から呼ぶ。DB 型 ≠ API 型(zod で境界を定義)。
5. **有料機能ゲート**: backend は `requireFeature(code)`、フロントは「ロールガード → `board.features.includes(code)` → 本体 or `FeatureLocked`」の順。
6. **UI**: PhosphorIcons 統一(自作 SVG 不可)。CSS Modules + `--ab-*` トークン。SP 差分は `@media (max-width: 639px)` に隔離し PC 無変更。外側余白は共通シェルが持つ。モーダルは共通 `Dialog`(SP でシート化)。
7. **ドキュメント同期**: 機能を変えたら `docs/requirements.md`(該当章 + 改訂履歴)と `docs/aikiboard-product-overview.md`(非エンジニア語り口)を必ずセット更新。本書(roadmap.md)の該当タスクにも完了を記す。
8. **ルーティング変更時**: `pnpm -C frontend build` で route 構成を検証。`.next/types` の誤検知は `.next` 削除 → 再ビルド。

### 推奨着手順(最初の 6 手)

ユーザー作業(Dashboard・DNS・credentials)とコード作業を並行できるよう配列している。

1. **R0-1**(ドキュメント是正) — 誤解の芽を摘む。PR 1 本、即日
2. **R1-1**(本番設定確認 + チェックリスト恒久化) — migration `009`〜`016` は適用済み確認済(2026-07-04)。残りは Dashboard 設定確認と実機スモークのみ
3. **R2-1**(アドミン任命) — 運営体制ストーリーの成立。並行して**ユーザーに R1-2(Resend DNS)と R1-3(OAuth credentials 確認)を依頼**
4. **R3-4 + R3-3**(招待の戻り導線 + QR) — 招待体験を完成させる。小さく速い
5. **R1-3**(OAuth) → **R1-4**(規約) — 一般公開の最低条件を満たす
6. **R3-1**(LP) → **R3-2**(オンボーディング) — ここまでで「知らない道場長が自力で立ち上がる」導線が閉じる

以降は R4(SP/言語/PWA)→ R5(運用基盤)→ R6(トライアル + Stripe)を、実際の道場のフィードバックを見ながら。**R6-0(トライアル)+ R6-2(公開ページ有料化)は必ず同時リリースとし、その 60 日以内に R6-1(Stripe)を届けること。**

---

## 6. ユーザー(オーナー)の判断・作業が必要な項目 一覧

| 種別 | 項目 | 関連 |
|---|---|---|
| ~~判断~~ | ~~公開ページ・テーマの Free 可否 / 人数上限~~ → **2026-07-04 確定済み**(公開ページ有料・テーマ Free・Free 無制限・Mini 15 名・60 日トライアル) | R6-0/R6-2 |
| 判断 | 監視・分析(Sentry 等)の導入可否(ルール上、明示指示が必要) | R5-6 |
| 判断 | 価格・トライアル条件の最終確定 | R6-3 |
| 判断 | アカウント削除の AikiNote との共通方針 | R2-4 |
| 作業 | 本番 Supabase: Exposed schemas・JWT 署名方式の確認(migration `009`〜`016` は適用済み確認済) | R1-1 |
| 作業 | Resend ドメイン認証(Cloudflare DNS)+ `wrangler secret put RESEND_API_KEY` | R1-2 |
| 作業 | Supabase Auth: Google/Apple provider と Redirect URL 設定(AikiNote 側設定の有無確認から) | R1-3 |
| 作業 | 利用規約・プライバシーポリシー文面の確定 | R1-4 |
| 作業 | Cloudflare Rate Limiting Rules 設定 | R5-1 |
| 作業 | Supabase バックアップ設定の確認 | R5-3 |
| 作業 | Stripe アカウント・Product/Price・Webhook・secrets 登録 | R6-1 |

---

*本書は 2026-07-04 の横断調査(docs 全体・マージ済み全 PR 本文・コードベース)に基づく。事実関係の根拠となるファイルパス・PR 番号は各タスクに記載した。次の改訂は、タスクの完了時または四半期ごとの棚卸し時に行うこと。*
