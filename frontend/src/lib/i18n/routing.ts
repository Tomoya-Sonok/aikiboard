import { createNavigation } from "next-intl/navigation";
import { defineRouting } from "next-intl/routing";

export const routing = defineRouting({
  // 対応ロケール
  locales: ["ja", "en"],

  // デフォルト
  defaultLocale: "ja",

  // ロケール prefix の付与方針
  // 'as-needed' = デフォルト(ja)はパスに prefix なし、その他は付与
  localePrefix: "as-needed",

  // 自動ロケール検出を無効化(URL のみで判定)
  localeDetection: false,
});

// next-intl の Link / redirect / usePathname / useRouter のラッパ
export const { Link, redirect, usePathname, useRouter } =
  createNavigation(routing);
