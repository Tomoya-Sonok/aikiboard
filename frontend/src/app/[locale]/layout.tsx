import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { NextIntlClientProvider } from "next-intl";
import { getMessages } from "next-intl/server";
import { routing } from "@/lib/i18n/routing";
import "@/styles/globals.css";

export const metadata: Metadata = {
  title: "AikiBoard",
  description:
    "合気道の道場・会のコミュニティを運営する管理者向けの道場管理＆コミュニケーションプラットフォーム",
};

interface LocaleLayoutProps {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}

export default async function LocaleLayout({
  children,
  params,
}: LocaleLayoutProps) {
  const { locale } = await params;

  const isSupportedLocale = routing.locales.some(
    (supportedLocale) => supportedLocale === locale,
  );
  if (!isSupportedLocale) {
    notFound();
  }

  const messages = await getMessages({ locale });

  return (
    <html lang={locale}>
      <body>
        <NextIntlClientProvider locale={locale} messages={messages}>
          {children}
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
