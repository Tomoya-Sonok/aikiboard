import { create } from "zustand";
import { persist } from "zustand/middleware";

// 永続 UI 設定(ADR 0002 B-7)。サイドバーの折りたたみ状態を localStorage に保存する。
// SSR リダイレクト判断には使わないため localStorage で問題ない。
//
// mobileNavOpen は SP のサイドバードロワーの開閉。一時的な UI 状態なので永続化しない
// (リロードで必ず閉じる)。persist の partialize で sidebarCollapsed のみ保存する。
type UiState = {
  sidebarCollapsed: boolean;
  toggleSidebar: () => void;
  mobileNavOpen: boolean;
  openMobileNav: () => void;
  closeMobileNav: () => void;
};

export const useUiStore = create<UiState>()(
  persist(
    (set) => ({
      sidebarCollapsed: false,
      toggleSidebar: () =>
        set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
      mobileNavOpen: false,
      openMobileNav: () => set({ mobileNavOpen: true }),
      closeMobileNav: () => set({ mobileNavOpen: false }),
    }),
    {
      name: "ab-ui",
      partialize: (state) => ({ sidebarCollapsed: state.sidebarCollapsed }),
    },
  ),
);
