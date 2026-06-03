// Hono backend が返す共通レスポンス形。
// ADR 0002 B-4: DB の型 ≠ API の型。API 契約はこの ApiResponse + Zod で定義する。

export type ApiResponse<T> = {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
};
