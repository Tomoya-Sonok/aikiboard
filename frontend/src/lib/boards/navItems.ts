import type { IconName } from "@/components/shared/Icon/Icon";

// ボード内ナビゲーション項目。labelKey は i18n の nav.<labelKey>。
// enabled:false は「準備中」(本実装は後続 PR)。pro は有料プラン機能(PRO バッジ表示)。
export type BoardNavItem = {
  id: string;
  labelKey: string;
  icon: IconName;
  pro?: boolean;
  enabled: boolean;
};

export const BOARD_NAV_ITEMS: BoardNavItem[] = [
  { id: "home", labelKey: "home", icon: "home", enabled: true },
  { id: "calendar", labelKey: "calendar", icon: "calendar", enabled: false },
  { id: "announce", labelKey: "announce", icon: "megaphone", enabled: false },
  { id: "feed", labelKey: "feed", icon: "feed", enabled: false },
  {
    id: "archive",
    labelKey: "archive",
    icon: "archive",
    pro: true,
    enabled: false,
  },
  { id: "money", labelKey: "money", icon: "yen", pro: true, enabled: false },
  { id: "members", labelKey: "members", icon: "users", enabled: false },
  {
    id: "activity",
    labelKey: "activity",
    icon: "activity",
    pro: true,
    enabled: false,
  },
  { id: "settings", labelKey: "settings", icon: "settings", enabled: false },
];
