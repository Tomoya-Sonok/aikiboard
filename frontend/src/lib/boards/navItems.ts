import {
  Archive,
  CalendarBlank,
  CurrencyJpy,
  GearSix,
  House,
  type Icon,
  ListChecks,
  Megaphone,
  Pulse,
  Rss,
  UsersThree,
} from "@phosphor-icons/react";

// ボード内ナビゲーション項目。labelKey は i18n の nav.<labelKey>。
// enabled:false は「準備中」(本実装は後続 PR)。pro は有料プラン機能(PRO バッジ表示)。
// adminOnly は owner/admin のみに表示(member には出さない。各ページでも自衛)。
// アイコンは PhosphorIcons を統一利用(AikiNote と同方針)。
export type BoardNavItem = {
  id: string;
  labelKey: string;
  icon: Icon;
  pro?: boolean;
  adminOnly?: boolean;
  enabled: boolean;
};

export const BOARD_NAV_ITEMS: BoardNavItem[] = [
  { id: "home", labelKey: "home", icon: House, enabled: true },
  { id: "calendar", labelKey: "calendar", icon: CalendarBlank, enabled: true },
  { id: "announce", labelKey: "announce", icon: Megaphone, enabled: true },
  { id: "feed", labelKey: "feed", icon: Rss, enabled: true },
  {
    id: "archive",
    labelKey: "archive",
    icon: Archive,
    pro: true,
    enabled: true,
  },
  {
    id: "money",
    labelKey: "money",
    icon: CurrencyJpy,
    pro: true,
    enabled: true,
  },
  { id: "members", labelKey: "members", icon: UsersThree, enabled: true },
  {
    id: "todo",
    labelKey: "todo",
    icon: ListChecks,
    adminOnly: true,
    enabled: true,
  },
  {
    id: "activity",
    labelKey: "activity",
    icon: Pulse,
    pro: true,
    enabled: true,
  },
  { id: "settings", labelKey: "settings", icon: GearSix, enabled: true },
];
