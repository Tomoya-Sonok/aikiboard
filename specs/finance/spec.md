# 会計の見える化(ステータス管理+収支可視化、有料プラン機能)

## 概要

決済はオフライン前提で、月謝の支払ステータス(月次)を手動記録し、支出記録とあわせて年次の月別収支をグラフ表示するowner/admin専用機能。有料プラン機能。

## ユーザーストーリー

- 管理者として、メンバーごとの月謝額を設定し、月ごとに「支払済/未払/免除」のステータスを手動で管理したい(`frontend/src/components/features/finance/FinanceView/FinanceView.tsx`の「月謝・支払」タブ)。
- 管理者として、会場費や備品購入などの支出を日付・項目・金額で記録したい(「支出」タブ、`ExpensesTab`)。
- 管理者として、年間を通じた収入(月謝入金)と支出を月別グラフで見て、収支バランスを把握したい(「収支」タブ、`SummaryTab`の棒グラフ)。
- Freeプランのユーザーはこの機能にアクセスできず、アップセル案内を見る(`FeatureLocked`)。

## 機能要件

- ✅ メンバー別月謝の設定・履歴管理(`effective_from`による履歴保持、`GET/PUT /api/finance/fees`)— `006_create_finance_tables.sql`(`member_fees`), `backend/src/routes/finance/index.ts`
- ✅ 月次(YYYYMM)の支払ステータス管理(`paid/unpaid/waived`、`GET/PUT /api/finance/payments`)、`paid`時は支払時点の月謝額をスナップショットとして`amount`に保存 — `finance/index.ts`
- ✅ 支出記録のCRUD(`GET/POST /api/finance/expenses`, `PATCH/DELETE /api/finance/expenses/:id`)— 同上
- ✅ 年次の月別収支サマリー(`GET /api/finance/summary`、収入=paidの月謝合計、支出=expense_entries合計)— 同上
- ✅ アクセスはowner/adminのみ(`financeAdminMiddleware`/`financeExpenseAdminMiddleware`)+ feature_flag `accounting`(`requireFeature("accounting")`、全エンドポイントに適用)— `finance.test.ts`
- ✅ フロント側でも`board.features.includes("accounting")`を確認、`canManage`でない場合はホームへリダイレクト — `frontend/src/app/[locale]/d/[slug]/money/page.tsx`
- ✅ ナビゲーションに`pro:true`バッジ表示
- ❓ `expense_entries.category`はDBコメント上「'venue', 'equipment', 'other'等。詳細仕様はPhase1で確定」とあるが、実装は自由入力の文字列(最大50文字)であり選択肢や分類マスタは存在しない
- ❓ 決済(Stripe)自体は本機能のスコープ外(オフライン前提)だが、「支払済」記録の裏付け(領収書・証跡など)を残す仕組みは無い

## 画面・API・テーブルの対応

- 画面: `frontend/src/app/[locale]/d/[slug]/money/page.tsx` → `FinanceView`(内部に`PaymentsTab`/`ExpensesTab`/`SummaryTab`)
- API: tRPC `finance.fees/setFee/payments/setPayment/expenses/addExpense/removeExpense/summary`
- テーブル: `aikiboard.member_fees`, `aikiboard.fee_payments`, `aikiboard.expense_entries`

## 未決事項

- [TBD] 支出カテゴリを固定選択肢化するか(現状フリーテキスト)
- [TBD] 支払記録の証跡管理(領収書添付等)の要否
- [TBD] 支出の編集UI・CSVエクスポート(roadmap.mdでは編集APIは実装済みでUIが無いと記載されているが、本調査ではUI未確認のまま)

## この粒度で切った理由

専用ルート(`finance`)・専用テーブル群(`member_fees`/`fee_payments`/`expense_entries`)・専用画面(`FinanceView`)という1対1の実装境界を持つため独立させた。有料プラン制御の詳細は[archive](../archive/spec.md)の「有料プラン制御の総括」を参照。
