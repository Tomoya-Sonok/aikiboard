// 公開ページの API 型(要件 4.7 / 4.1.2)。backend /api/public に対応(anon)。

export type PublicPageConfig = {
  instructorIntro?: string;
  access?: string;
  organization?: string;
  contactEmail?: string;
  contactPhone?: string;
  contactUrl?: string;
  showCalendar?: boolean;
  showContact?: boolean;
};

export type PublicBoard = {
  name: string;
  slug: string;
  logoUrl: string | null;
  themeColorCode: string;
  description: string | null;
  publicPageConfig: PublicPageConfig;
  dojoNames: string[];
};

export type PublicEventOccurrence = {
  eventId: string;
  occurrenceStart: string;
  startAt: string;
  endAt: string;
  place: string;
  instructorName: string | null;
  note: string | null;
};

// ボード設定(管理画面)。GET/PATCH /api/board-settings に対応。
export type BoardSettings = {
  logoUrl: string | null;
  themeColorCode: string;
  description: string | null;
  publicPageConfig: PublicPageConfig;
  isPublic: boolean;
};
