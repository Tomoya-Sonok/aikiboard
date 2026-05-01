import { getRequestConfig } from "next-intl/server";
import { routing } from "./routing";

export default getRequestConfig(async ({ requestLocale }) => {
  let locale = await requestLocale;

  const isSupportedLocale = (
    value: string | undefined,
  ): value is (typeof routing.locales)[number] =>
    typeof value === "string" &&
    (routing.locales as readonly string[]).includes(value);

  if (!isSupportedLocale(locale)) {
    locale = routing.defaultLocale;
  }

  return {
    locale,
    messages: (await import(`../../translations/${locale}.json`)).default,
  };
});
