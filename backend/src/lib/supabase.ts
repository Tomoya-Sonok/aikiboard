// Supabase クライアントのファクトリ。
// バックエンドは常に SERVICE_ROLE_KEY で初期化する(RLS バイパス、admin 権限で動作)。
// フロント経由のユーザー認証は Frontend 側の SUPABASE_ANON_KEY + RLS で防御層を作る。

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

interface SupabaseEnv {
  SUPABASE_URL?: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
  SUPABASE_ANON_KEY?: string;
}

let cachedClient: SupabaseClient | null = null;

const fetchGlobals =
  typeof fetch !== "undefined"
    ? { fetch, Headers, Request, Response }
    : undefined;

export const resolveSupabaseClient = (
  env: SupabaseEnv,
): SupabaseClient | null => {
  if (cachedClient) {
    return cachedClient;
  }

  const url = env.SUPABASE_URL ?? "";
  const key = env.SUPABASE_SERVICE_ROLE_KEY ?? "";
  if (!url || !key) {
    return null;
  }

  cachedClient = createClient(url, key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
    ...(fetchGlobals ? { global: fetchGlobals } : {}),
  });

  return cachedClient;
};

export const getCachedSupabaseClient = (): SupabaseClient | null =>
  cachedClient;
