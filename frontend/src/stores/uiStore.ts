import { create } from "zustand";
import { persist } from "zustand/middleware";

// 永続 UI 設定(ADR 0002 B-7)。サイドバーの折りたたみ状態を localStorage に保存する。
// SSR リダイレクト判断には使わないため localStorage で問題ない。
type UiState = {
  sidebarCollapsed: boolean;
  toggleSidebar: () => void;
};

export const useUiStore = create<UiState>()(
  persist(
    (set) => ({
      sidebarCollapsed: false,
      toggleSidebar: () =>
        set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
    }),
    { name: "ab-ui" },
  ),
);
