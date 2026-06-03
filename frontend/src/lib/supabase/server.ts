// サーバーサイドの Supabase クライアント。
// BFF(tRPC)で session 検証(getUser)と access_token 取得(getSession)に使う。
// ADR 0002 B-5: cookie 由来の session を一元的に扱う。

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

// cookie を読み書きしない(SSG / service role 用)空実装。
const noopCookies = {
  get() {
    return undefined;
  },
  set() {},
  remove() {},
};

// 認証済みユーザー用(ANON_KEY + cookie)。Server Component / Route Handler から呼ぶ。
export async function getServerSupabase() {
  try {
    const cookieStore = await cookies();
    return createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        set(name: string, value: string, options) {
          try {
            cookieStore.set({ name, value, ...options });
          } catch {
            // Server Component は読み取り専用。cookie 書き込みは proxy.ts(middleware)が担う。
          }
        },
        remove(name: string, options) {
          try {
            cookieStore.set({ name, value: "", ...options });
          } catch {
            // 同上
          }
        },
      },
    });
  } catch {
    // SSG 等で cookies() が使えない場合のフォールバック
    return createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      cookies: noopCookies,
    });
  }
}

// RLS をバイパスする service role クライアント(cookie 非依存)。
export function getServiceRoleSupabase() {
  return createServerClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    cookies: noopCookies,
  });
}
