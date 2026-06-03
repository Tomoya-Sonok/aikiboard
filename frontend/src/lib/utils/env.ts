// 実行環境ごとの URL ヘルパ。

// アプリ自身のベース URL。ブラウザでは現在のオリジン、サーバーでは APP_URL。
export function getBaseUrl(): string {
  if (typeof window !== "undefined") {
    return window.location.origin;
  }
  return process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
}

// BFF(tRPC)から呼ぶ Hono backend のベース URL。
// サーバー間通信は NEXT_SERVER_API_URL を優先する。
export function getApiBaseUrl(): string {
  return (
    process.env.NEXT_SERVER_API_URL ??
    process.env.NEXT_PUBLIC_API_URL ??
    "http://localhost:8787"
  );
}
