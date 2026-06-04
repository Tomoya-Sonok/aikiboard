// 稽古日時の表示フォーマット。Intl.DateTimeFormat の timeZone:"Asia/Tokyo" で、
// ブラウザのタイムゾーンに依存せず常に JST で表示する。

export type CalendarLocale = "ja" | "en";

const intlLocale = (locale: CalendarLocale): string =>
  locale === "ja" ? "ja-JP" : "en-US";

export const formatJstTime = (iso: string, locale: CalendarLocale): string =>
  new Intl.DateTimeFormat(intlLocale(locale), {
    timeZone: "Asia/Tokyo",
    hour: "2-digit",
    minute: "2-digit",
    hour12: locale === "en",
  }).format(new Date(iso));

// 開始–終了の時刻レンジ(同日前提)。
export const formatJstTimeRange = (
  startIso: string,
  endIso: string,
  locale: CalendarLocale,
): string =>
  `${formatJstTime(startIso, locale)}–${formatJstTime(endIso, locale)}`;

export const formatJstDateLong = (
  iso: string,
  locale: CalendarLocale,
): string =>
  new Intl.DateTimeFormat(intlLocale(locale), {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "short",
  }).format(new Date(iso));

// (year, month=0-11)の月見出し。月内の正午 JST を基準にして安全に整形する。
export const formatJstMonthTitle = (
  year: number,
  month: number,
  locale: CalendarLocale,
): string =>
  new Intl.DateTimeFormat(intlLocale(locale), {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "long",
  }).format(new Date(Date.UTC(year, month, 1, 3, 0, 0)));
