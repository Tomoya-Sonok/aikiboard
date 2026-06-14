"use client";

import { CaretDoubleLeft, MagnifyingGlass, Plus } from "@phosphor-icons/react";
import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { BOARD_NAV_ITEMS } from "@/lib/boards/navItems";
import { useAuth } from "@/lib/hooks/useAuth";
import { usePathname, useRouter } from "@/lib/i18n/routing";
import { trpcClient } from "@/lib/trpc/client";
import type { BoardSummary } from "@/lib/types/board";
import { useUiStore } from "@/stores/uiStore";
import styles from "./BoardSidebar.module.css";

type Props = {
  boards: BoardSummary[];
  activeSlug: string;
};

// 現在の URL から「どのナビ項目がアクティブか」を求める。
// /d/<slug> はホーム、/d/<slug>/<section> は section。
function activeSectionFromPath(pathname: string, slug: string): string {
  const segments = pathname.split("/").filter(Boolean);
  const dIndex = segments.indexOf("d");
  if (dIndex === -1 || segments[dIndex + 1] !== slug) {
    return "home";
  }
  return segments[dIndex + 2] ?? "home";
}

export function BoardSidebar({ boards, activeSlug }: Props) {
  const t = useTranslations("nav");
  const router = useRouter();
  const pathname = usePathname();
  const activeSection = activeSectionFromPath(pathname, activeSlug);
  const { user, signOut } = useAuth();
  const collapsed = useUiStore((s) => s.sidebarCollapsed);
  const toggleSidebar = useUiStore((s) => s.toggleSidebar);

  // アクティブボードのお知らせ未読数(announce ナビのバッジ用)。
  const activeBoard = boards.find((b) => b.slug === activeSlug);
  const activeBoardId = activeBoard?.id;
  const isActiveAdmin =
    activeBoard?.role === "owner" || activeBoard?.role === "admin";
  const { data: unreadRes } = useQuery({
    queryKey: ["announcements", activeBoardId, "unreadCount"],
    queryFn: () =>
      trpcClient.announcements.unreadCount.query({
        boardId: activeBoardId ?? "",
      }),
    enabled: Boolean(activeBoardId),
  });
  const unreadAnnouncements = unreadRes?.data?.count ?? 0;

  // 管理者のみ: アクティブボードの参加申請(承認待ち)件数を members ナビのバッジに出す。
  const { data: pendingRes } = useQuery({
    queryKey: ["membershipRequests", activeBoardId],
    queryFn: () =>
      trpcClient.membershipRequests.listForBoard.query({
        boardId: activeBoardId ?? "",
      }),
    enabled: Boolean(activeBoardId) && isActiveAdmin,
  });
  const pendingRequests = pendingRes?.data?.length ?? 0;

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
          <CaretDoubleLeft size={14} />
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
            <Plus size={14} />
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

        {!collapsed && (
          <button
            type="button"
            className={styles.discoverLink}
            onClick={() => router.push("/boards/discover")}
          >
            <MagnifyingGlass size={13} />
            <span>{t("discoverBoards")}</span>
          </button>
        )}
      </div>

      <nav className={styles.nav}>
        {BOARD_NAV_ITEMS.map((item) => {
          const isActive = item.id === activeSection;
          const NavIcon = item.icon;
          return (
            <button
              type="button"
              key={item.id}
              className={`${styles.navItem} ${isActive ? styles.navItemActive : ""} ${item.enabled ? "" : styles.navItemDisabled}`}
              onClick={() => {
                if (!item.enabled) {
                  return;
                }
                router.push(
                  item.id === "home"
                    ? `/d/${activeSlug}`
                    : `/d/${activeSlug}/${item.id}`,
                );
              }}
              disabled={!item.enabled}
              title={item.enabled ? undefined : t("comingSoon")}
            >
              <span className={styles.navAccent} />
              <NavIcon size={16} className={styles.navIcon} />
              {!collapsed && (
                <span className={styles.navLabel}>{t(item.labelKey)}</span>
              )}
              {!collapsed && item.pro && (
                <span className={styles.proBadge}>{t("pro")}</span>
              )}
              {item.id === "announce" && unreadAnnouncements > 0 ? (
                collapsed ? (
                  <span className={styles.navUnreadDot} aria-hidden="true" />
                ) : (
                  <span className={styles.navUnreadBadge}>
                    {unreadAnnouncements}
                  </span>
                )
              ) : null}
              {item.id === "members" && pendingRequests > 0 ? (
                collapsed ? (
                  <span className={styles.navUnreadDot} aria-hidden="true" />
                ) : (
                  <span className={styles.navUnreadBadge}>
                    {pendingRequests}
                  </span>
                )
              ) : null}
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
