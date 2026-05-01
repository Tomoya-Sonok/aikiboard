// Next.js 16+ の middleware は `src/proxy.ts` に置くのが推奨(`middleware.ts` は Deprecated)。
// Phase 0 では i18n リライトのみ実装し、認証ガード等は Phase 1 で追加する。

import { type NextRequest, NextResponse } from "next/server";
import createIntlMiddleware from "next-intl/middleware";
import { routing } from "./lib/i18n/routing";

const handleI18nRouting = createIntlMiddleware(routing);

export function proxy(request: NextRequest): NextResponse {
  return (
    handleI18nRouting(request) ||
    NextResponse.next({ request: { headers: request.headers } })
  );
}

export const config = {
  matcher: ["/((?!api|_next|.*\\..*).*)"],
};
