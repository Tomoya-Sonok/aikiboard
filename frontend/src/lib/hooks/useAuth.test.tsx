import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

// vi.mock は巻き上げられるため、参照は vi.hoisted でまとめて巻き上げる。
const mocks = vi.hoisted(() => ({
  signInWithPassword: vi.fn(),
  signOut: vi.fn(),
  getSession: vi.fn(),
  onAuthStateChange: vi.fn(),
  createMutate: vi.fn(),
  getUserInfoQuery: vi.fn(),
}));

vi.mock("@/lib/supabase/client", () => ({
  getClientSupabase: () => ({
    auth: {
      getSession: mocks.getSession,
      onAuthStateChange: mocks.onAuthStateChange,
      signInWithPassword: mocks.signInWithPassword,
      signOut: mocks.signOut,
    },
  }),
}));

vi.mock("@/lib/trpc/client", () => ({
  trpcClient: {
    users: {
      create: { mutate: mocks.createMutate },
      getUserInfo: { query: mocks.getUserInfoQuery },
    },
  },
}));

import { AuthProvider, useAuth } from "./useAuth";

function wrapper({ children }: { children: ReactNode }) {
  return <AuthProvider>{children}</AuthProvider>;
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getSession.mockResolvedValue({ data: { session: null } });
  mocks.onAuthStateChange.mockReturnValue({
    data: { subscription: { unsubscribe: vi.fn() } },
  });
});

describe("useAuth.signUp", () => {
  it("create 成功後に signInWithPassword を呼ぶ", async () => {
    // Arrange
    mocks.createMutate.mockResolvedValue({ success: true, data: { id: "u1" } });
    mocks.signInWithPassword.mockResolvedValue({ error: null });
    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.isInitializing).toBe(false));

    // Act
    await act(async () => {
      await result.current.signUp({
        email: "taro@example.com",
        password: "Passw0rd!",
        username: "taro",
      });
    });

    // Assert
    expect(mocks.createMutate).toHaveBeenCalledWith({
      email: "taro@example.com",
      password: "Passw0rd!",
      username: "taro",
    });
    expect(mocks.signInWithPassword).toHaveBeenCalledWith({
      email: "taro@example.com",
      password: "Passw0rd!",
    });
  });

  it("create 失敗時は throw し signInWithPassword を呼ばない", async () => {
    // Arrange
    mocks.createMutate.mockResolvedValue({
      success: false,
      error: "既に登録済みのメールアドレスです",
    });
    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.isInitializing).toBe(false));

    // Act & Assert
    await act(async () => {
      await expect(
        result.current.signUp({
          email: "taro@example.com",
          password: "Passw0rd!",
          username: "taro",
        }),
      ).rejects.toThrow("既に登録済みのメールアドレスです");
    });
    expect(mocks.signInWithPassword).not.toHaveBeenCalled();
  });
});

describe("useAuth.signInWithCredentials", () => {
  it("認証エラー時は throw する", async () => {
    // Arrange
    mocks.signInWithPassword.mockResolvedValue({
      error: { message: "Invalid login credentials" },
    });
    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.isInitializing).toBe(false));

    // Act & Assert
    await act(async () => {
      await expect(
        result.current.signInWithCredentials({
          email: "taro@example.com",
          password: "wrong",
        }),
      ).rejects.toThrow("Invalid login credentials");
    });
  });
});
