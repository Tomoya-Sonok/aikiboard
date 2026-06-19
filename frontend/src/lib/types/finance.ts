// 会計の API 型(要件 4.8)。backend /api/finance に対応。

export type FeeMember = {
  userId: string;
  username: string;
  profileImageUrl: string | null;
  monthlyFee: number | null;
};

export type PaymentStatus = "paid" | "unpaid" | "waived";

export type PaymentMember = {
  userId: string;
  username: string;
  profileImageUrl: string | null;
  monthlyFee: number | null;
  status: PaymentStatus;
};

export type Expense = {
  id: string;
  date: string;
  category: string;
  amount: number;
  note: string | null;
};

export type FinanceSummary = {
  year: number;
  months: { month: number; income: number; expense: number }[];
  totalIncome: number;
  totalExpense: number;
};
