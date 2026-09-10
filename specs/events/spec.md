# 稽古カレンダー+出欠管理

## 概要

道場の稽古(単発/定期)をシリーズ単位で登録し、月表示カレンダーに展開して表示する。メンバーは各回に参加/不参加を表明でき、管理者は稽古の作成・編集・削除、特定回の休講/上書き、出欠集計・未回答者一覧の閲覧ができる。

## ユーザーストーリー

- 管理者として、場所(必須・1〜200字)、担当指導者(任意・100字以内)、備考(任意・2000字以内)、公開/非公開を指定して稽古を作成したい(`frontend/src/components/features/events/EventForm/EventForm.tsx`)。
- 管理者として、毎日/毎週/毎月の定期稽古を、間隔(1〜99)・曜日(週次のみ必須)・終了条件(なし/日付指定/回数指定1〜366)付きで設定したい(`EventForm.tsx` recurrence fieldset、`backend/src/routes/events/index.ts` recurrenceSchema)。
- 管理者として、定期稽古のうち特定回だけ休講にしたり、時刻・場所・指導者・備考を上書きしたい(`EventDetailModal.tsx` の「この回を休講/このみ編集」ボタン)。
- メンバーとして、カレンダーの日付をクリックして日時・場所・指導者・備考・出欠状況を確認したい(`CalendarMonth.tsx` chip→`EventDetailModal.tsx`)。
- メンバーとして、参加/不参加ボタンを押して出欠を表明し、同じボタンをもう一度押すと未回答に戻したい(`RsvpControl.tsx`)。
- メンバーとして、その回の参加者・不参加者の氏名とアバターを見たい。管理者は未回答者も見たい(`AttendeeList.tsx`)。

## 機能要件

- ✅ 稽古(シリーズ)作成。開始<終了のバリデーションをサーバー側`refine`とフロント側両方で実施 — `backend/src/routes/events/index.ts`, `EventForm.tsx`
- ✅ 定期稽古設定(RFC5545サブセット: `FREQ=DAILY|WEEKLY|MONTHLY`+`INTERVAL`/`BYDAY`/`BYMONTHDAY`/`UNTIL`or`COUNT`)。週次は曜日未選択だとフロントでエラー — `backend/src/lib/recurrence.ts`, `EventForm.tsx`
- ✅ シリーズ全体の編集(PATCH)・削除(DELETE、確認ダイアログあり)— `events/index.ts`
- ✅ 「この回だけ休講」(`event_overrides.is_cancelled`)、「この回だけ上書き」(時刻/場所/指導者/備考)— `events/index.ts`
- ✅ occurrenceアンカー検証: 任意の`occurrenceStart`で出欠・例外のゴミ行を作らせない防御(1msウィンドウで再展開して一致確認)— `events/index.ts`(`checkOccurrenceAnchor`)
- ✅ 出欠表明(PUT)/取消(DELETE、未回答へ戻す)— `events/index.ts`, `RsvpControl.tsx`
- ✅ 出欠名簿: 参加者・不参加者は全メンバー閲覧可、未回答者は管理者のみ。名簿は「現メンバー」に限定(退会者除外)— `events/index.ts`
- ✅ 月表示カレンダー(JST壁時計基準の6週グリッド、月送り・今日ボタン)— `frontend/src/lib/calendar/monthGrid.ts`, `CalendarMonth.tsx`
- ✅ 取得ウィンドウは最大100日に制限(暴走防止)— `events/index.ts`(`MAX_WINDOW_DAYS`)
- ✅ 「次の稽古」取得API(`GET /api/events/next`、過去60日〜未来180日を展開してnow以降の最初の1件)— `events/index.ts`
- 🚧 週表示・リスト表示ボタンは常時disabledで「近日公開」ツールチップのみ(未実装)— `CalendarMonth.tsx:157-172`
- 🚧 未認証向け公開カレンダー(`GET /api/public/boards/:slug/events`)は[public](../public/spec.md)機能として別途実装済み
- ❓ `PATCH /api/events/:id`(シリーズ編集)は`startAt`/`endAt`も受け付けるが、フォームは`editSeries`モードで日時欄を非表示にしており実質使われない。将来のUI拡張のための先行実装か単なる未整理かは断定不可
- ❓ `isPublic`は稽古単体のフラグだが、実際に未認証へ公開されるかはボード側の公開設定にも依存する。EventForm/EventDetailModalにボード非公開時の注意書き等の連動表示は見当たらない

## 画面・API・テーブルの対応

- 画面: `frontend/src/app/[locale]/d/[slug]/calendar/page.tsx` → `CalendarMonth` → `EventDetailModal` / `EventForm` / `RsvpControl` / `AttendeeList`
- API(`frontend/src/server/trpc/routers/events.ts`):
  - `events.list` ↔ `GET /api/events`
  - `events.create` ↔ `POST /api/events`
  - `events.update` ↔ `PATCH /api/events/:id`
  - `events.remove` ↔ `DELETE /api/events/:id`
  - `events.cancelOccurrence` ↔ `POST /api/events/:id/occurrences/cancel`
  - `events.overrideOccurrence` ↔ `POST /api/events/:id/occurrences/override`
  - `events.next` ↔ `GET /api/events/next`
  - `events.occurrenceRsvps` ↔ `GET /api/events/:id/rsvps`
  - `events.setRsvp` ↔ `PUT /api/events/:id/rsvp`
  - `events.clearRsvp` ↔ `DELETE /api/events/:id/rsvp`
- テーブル: `aikiboard.events`, `aikiboard.event_rsvps`(PKは`(event_id, occurrence_start, user_id)`), `aikiboard.event_overrides`

## recurrence実装の重複についての注記

展開ロジック本体(繰り返し生成・JST変換・`MAX_ITERATIONS`ガード)は`backend/src/lib/recurrence.ts`の`expandEvent`にのみ存在し重複はない。一方、RRULE文字列のparse処理は backend(`parseRule`)とfrontend(`frontend/src/lib/recurrence/recurrence.ts`の`parseRuleString`、表示専用)の2箇所に別実装されており、現状は一致しているが将来の仕様変更で追随漏れが起きるリスクがある(書き込み経路はこの重複コードを通らないため実害は表示ロジックの二重メンテナンスに限定)。JSTオフセット定数も3ファイルに個別実装されている。

## 未決事項

- [TBD] シリーズの個々のoccurrenceへの完全detachは未実装
- [TBD] `MAX_WINDOW_DAYS=100`/`NEXT_HORIZON_DAYS=180`/`NEXT_PAST_HORIZON_DAYS=60`の具体的な選定根拠
- [TBD] `isPublic`(稽古)とボードの公開設定の整合性チェックがUI/APIレベルで明示されているか

## この粒度で切った理由

専用マイグレーション(`003`/`010`)・専用権限ミドルウェア(`boardAdminMiddleware`系)・専用tRPCルーター(`events`)・専用ナビゲーション画面(カレンダー)を持ち、コード上のモジュール境界が明確なため独立させた。出欠イベントの発火先である[notifications](../notifications/spec.md)とは受発信の関係にあるが、責務(スケジュール管理 vs 通知配信)が異なるため別機能とした。
