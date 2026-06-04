"use client";

import { useTranslations } from "next-intl";
import { Icon } from "@/components/shared/Icon/Icon";
import { BOARD_NAV_ITEMS } from "@/lib/boards/navItems";
import { useAuth } from "@/lib/hooks/useAuth";
import { useRouter } from "@/lib/i18n/routing";
import type { BoardSummary } from "@/lib/types/board";
import { useUiStore } from "@/stores/uiStore";
import styles from "./BoardSidebar.module.css";

type Props = {
  boards: BoardSummary[];
  activeSlug: string;
};

export function BoardSidebar({ boards, activeSlug }: Props) {
  const t = useTranslations("nav");
  const router = useRouter();
  const { user, signOut } = useAuth();
  const collapsed = useUiStore((s) => s.sidebarCollapsed);
  const toggleSidebar = useUiStore((s) => s.toggleSidebar);

  const handleSignOut = async () => {
    await signOut();
    router.replace("/login");
  };

  const userLabel = user?.username ?? user?.email ?? "";
  const userInitial = (userLabel || "?").charAt(0).toUpperCase();

  return (
    <aside className={`${styles.sidebar} ${collapsed ? styles.collapsed : ""}`}>
      <div className={styles.logoRow}>
        {!collapsed && <span className={styles.logo}>AikiBoard</span>}
        <button
          type="button"
          className={styles.collapseBtn}
          onClick={toggleSidebar}
          aria-label={t("collapse")}
        >
          <Icon name="chevron-double-left" size={14} />
        </button>
      </div>

      <div className={styles.switcher}>
        <div className={styles.boardIcons}>
          {boards.map((board) => (
            <button
              type="button"
              key={board.id}
              title={board.name}
              className={`${styles.boardIcon} ${board.slug === activeSlug ? styles.boardIconActive : ""}`}
              onClick={() => router.push(`/d/${board.slug}`)}
            >
              {Array.from(board.name)[0] ?? "?"}
            </button>
          ))}
          <button
            type="button"
            className={styles.addBoard}
            title={t("newBoard")}
            onClick={() => router.push("/boards/new")}
          >
            <Icon name="plus" size={14} />
          </button>
        </div>

        {!collapsed && (
          <div className={styles.boardLabels}>
            {boards.map((board) => (
              <button
                type="button"
                key={board.id}
                className={`${styles.boardLabel} ${board.slug === activeSlug ? styles.boardLabelActive : ""}`}
                onClick={() => router.push(`/d/${board.slug}`)}
              >
                <span className={styles.boardName}>{board.name}</span>
                <span className={styles.boardMeta}>
                  {board.planName} ·{" "}
                  {t("memberCount", { count: board.memberCount })}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      <nav className={styles.nav}>
        {BOARD_NAV_ITEMS.map((item) => {
          const isActive = item.id === "home";
          return (
            <button
              type="button"
              key={item.id}
              className={`${styles.navItem} ${isActive ? styles.navItemActive : ""} ${item.enabled ? "" : styles.navItemDisabled}`}
              onClick={() => {
                if (item.enabled && item.id === "home") {
                  router.push(`/d/${activeSlug}`);
                }
              }}
              disabled={!item.enabled}
              title={item.enabled ? undefined : t("comingSoon")}
            >
              <span className={styles.navAccent} />
              <Icon
                name={item.icon}
                size={15}
                stroke={1.6}
                className={styles.navIcon}
              />
              {!collapsed && (
                <span className={styles.navLabel}>{t(item.labelKey)}</span>
              )}
              {!collapsed && item.pro && (
                <span className={styles.proBadge}>{t("pro")}</span>
              )}
            </button>
          );
        })}
      </nav>

      <div className={styles.footer}>
        <span className={styles.userAvatar}>{userInitial}</span>
        {!collapsed && (
          <div className={styles.userInfo}>
            <span className={styles.userName}>{userLabel}</span>
            <button
              type="button"
              className={styles.signOut}
              onClick={handleSignOut}
            >
              {t("signOut")}
            </button>
          </div>
        )}
      </div>
    </aside>
  );
}
