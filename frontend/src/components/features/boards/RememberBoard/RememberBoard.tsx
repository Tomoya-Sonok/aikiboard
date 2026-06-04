"use client";

import { useEffect } from "react";
import { LAST_BOARD_COOKIE } from "@/lib/boards/resolveDefaultBoard";

// いま開いているボードの slug を cookie に記録する。次回ログイン時のリゾルバ(/home)が読む。
// Server Component からは cookie を書けないため、クライアントで記録する。
const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

export function RememberBoard({ slug }: { slug: string }) {
  useEffect(() => {
    // biome-ignore lint/suspicious/noDocumentCookie: 単純な cookie 書き込みで十分(CookieStore API はブラウザ対応が限定的)
    document.cookie = `${LAST_BOARD_COOKIE}=${slug}; path=/; max-age=${ONE_YEAR_SECONDS}; SameSite=Lax`;
  }, [slug]);
  return null;
}
