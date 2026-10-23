// OAuth のコールバック(specs/auth/spec.md「OAuth ログインの仕様」)。
// AikiNote の frontend/src/app/auth/callback/route.ts に準拠する。
//
// [locale] の外に置く: Supabase の Redirect URL に登録するのは 1 本にしたいため。
// locale は NEXT_LOCALE cookie から復元し、routing の localePrefix: "as-needed" に従って
// 既定ロケール(ja)は prefix 無し、それ以外は /<locale> を付けてリダイレクトする。

import { type CookieOptions, createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { type NextRequest, NextResponse } from "next/server";
import { routing } from "@/lib/i18n/routing";
import { ensureOAuthUser } from "@/lib/server/ensure-oauth-user";

const buildLocalizedUrl = (
  origin: string,
  locale: string,
  pathWithLeadingSlash: string,
) => {
  const localePrefix = locale === routing.defaultLocale ? "" : `/${locale}`;
  return new URL(`${localePrefix}${pathWithLeadingSlash}`, origin);
};

// ローカル開発は `next dev -H 0.0.0.0` で起動するため、0.0.0.0 のままだと
// リダイレクト先が開けない。localhost に寄せる(AikiNote と同じ対処)。
const normalizeOrigin = (url: URL) => {
  if (url.hostname === "0.0.0.0") {
    const portSegment = url.port ? `:${url.port}` : "";
    return `${url.protocol}//localhost${portSegment}`;
  }
  return url.origin;
};

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const redirectOrigin = normalizeOrigin(requestUrl);
  const cookieStore = await cookies();
  const locale = cookieStore.get("NEXT_LOCALE")?.value ?? routing.defaultLocale;
  const buildUrl = (path: string) =>
    buildLocalizedUrl(redirectOrigin, locale, path);

  const code = requestUrl.searchParams.get("code");
  if (!code) {
    // ユーザーが同意画面をキャンセルした場合などはここに来る。
    return NextResponse.redirect(buildUrl("/login"));
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseAnonKey) {
    console.error("Supabase の環境変数が未設定");
    return NextResponse.redirect(buildUrl("/login?error=configuration"));
  }

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(
        cookiesToSet: { name: string; value: string; options: CookieOptions }[],
      ) {
        for (const { name, value, options } of cookiesToSet) {
          cookieStore.set({ name, value, ...options });
        }
      },
    },
  });

  try {
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      console.error("認証コードの交換に失敗", error);
      return NextResponse.redirect(buildUrl("/login?error=auth_error"));
    }

    // 初回ログインなら public."User" 行を作る(既存ユーザーは何もしない)。
    // 失敗してもログイン自体は成立させる(ensureOAuthUser は例外を投げない)。
    if (data?.user?.email) {
      await ensureOAuthUser({
        id: data.user.id,
        email: data.user.email,
        user_metadata: data.user.user_metadata,
        identities: data.user.identities,
      });
    }

    // /home は既存のリゾルバ。所属ボードがあればそのボードへ、無ければ /boards/new へ振り分ける。
    return NextResponse.redirect(buildUrl("/home"));
  } catch (error) {
    console.error("認証コールバックで予期しない例外", error);
    return NextResponse.redirect(buildUrl("/login?error=auth_error"));
  }
}
