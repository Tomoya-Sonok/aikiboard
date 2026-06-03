// Next.js 16+ の middleware は `src/proxy.ts` に置く(`middleware.ts` は Deprecated)。
// i18n ルーティング(next-intl)に加え、Supabase の session 同期を行う:
// リクエストの cookie から session を最新化し、更新された cookie をレスポンスへ書き戻す。
// 認証ガード(未認証リダイレクト)は (authenticated) の Server Component layout で行う。

import { type CookieOptions, createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";
import createIntlMiddleware from "next-intl/middleware";
import { routing } from "./lib/i18n/routing";

const handleI18nRouting = createIntlMiddleware(routing);

export async function proxy(request: NextRequest): Promise<NextResponse> {
  // まず i18n ルーティングを解決(リライト/リダイレクト含む)
  const response =
    handleI18nRouting(request) ||
    NextResponse.next({ request: { headers: request.headers } });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseAnonKey) {
    return response;
  }

  // session を最新化し、ローテーションされた cookie を response に書き戻す。
  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      get(name: string) {
        return request.cookies.get(name)?.value;
      },
      set(name: string, value: string, options: CookieOptions) {
        response.cookies.set({ name, value, ...options });
      },
      remove(name: string, options: CookieOptions) {
        response.cookies.set({ name, value: "", ...options });
      },
    },
  });

  await supabase.auth.getSession();

  return response;
}

export const config = {
  matcher: ["/((?!api|_next|.*\\..*).*)"],
};
