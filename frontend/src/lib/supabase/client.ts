"use client";

// ブラウザ用 Supabase クライアント。
// GoTrueClient は複数インスタンスを立てると認証状態が不整合になりうるため、
// モジュールスコープで singleton を維持する。

import { createBrowserClient } from "@supabase/ssr";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

let cachedClient: ReturnType<typeof createBrowserClient> | undefined;

export function getClientSupabase() {
  if (cachedClient) {
    return cachedClient;
  }
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      "Supabase の環境変数が未設定です(NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY)",
    );
  }
  cachedClient = createBrowserClient(supabaseUrl, supabaseAnonKey);
  return cachedClient;
}
