import {
  Archive,
  CalendarBlank,
  CurrencyJpy,
  GearSix,
  House,
  type Icon,
  Megaphone,
  Pulse,
  Rss,
  UsersThree,
} from "@phosphor-icons/react";

// ボード内ナビゲーション項目。labelKey は i18n の nav.<labelKey>。
// enabled:false は「準備中」(本実装は後続 PR)。pro は有料プラン機能(PRO バッジ表示)。
// アイコンは PhosphorIcons を統一利用(AikiNote と同方針)。
export type BoardNavItem = {
  id: string;
  labelKey: string;
  icon: Icon;
  pro?: boolean;
  enabled: boolean;
};

export const BOARD_NAV_ITEMS: BoardNavItem[] = [
  { id: "home", labelKey: "home", icon: House, enabled: true },
  { id: "calendar", labelKey: "calendar", icon: CalendarBlank, enabled: false },
  { id: "announce", labelKey: "announce", icon: Megaphone, enabled: false },
  { id: "feed", labelKey: "feed", icon: Rss, enabled: false },
  {
    id: "archive",
    labelKey: "archive",
    icon: Archive,
    pro: true,
    enabled: false,
  },
  {
    id: "money",
    labelKey: "money",
    icon: CurrencyJpy,
    pro: true,
    enabled: false,
  },
  { id: "members", labelKey: "members", icon: UsersThree, enabled: false },
  {
    id: "activity",
    labelKey: "activity",
    icon: Pulse,
    pro: true,
    enabled: false,
  },
  { id: "settings", labelKey: "settings", icon: GearSix, enabled: false },
];
