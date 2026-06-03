"use client";

// 認証状態を一元管理する Provider(ADR 0002 B-5: AuthProvider Context で一元管理)。
// session は Supabase の onAuthStateChange で追従し、profile は BFF(tRPC)から取得する。
// 最小実装: AikiNote のような retry / timeout / native bridge は持ち込まない。

import type { AuthChangeEvent, Session } from "@supabase/supabase-js";
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { getClientSupabase } from "@/lib/supabase/client";
import { trpcClient } from "@/lib/trpc/client";

export type AuthUser = {
  id: string;
  email: string | null;
  username: string | null;
  profileImageUrl: string | null;
};

type Credentials = { email: string; password: string };
type SignUpInput = { email: string; password: string; username: string };

interface AuthContextValue {
  user: AuthUser | null;
  isInitializing: boolean;
  isProcessing: boolean;
  signInWithCredentials: (input: Credentials) => Promise<void>;
  signUp: (input: SignUpInput) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

// BFF から profile を取得。失敗時は session の情報のみでフォールバックする。
async function fetchProfile(
  userId: string,
  fallbackEmail: string | null,
): Promise<AuthUser> {
  try {
    const res = await trpcClient.users.getUserInfo.query({ userId });
    if (res.success && res.data) {
      return {
        id: res.data.id,
        email: res.data.email,
        username: res.data.username,
        profileImageUrl: res.data.profile_image_url,
      };
    }
  } catch (error) {
    console.error("プロフィール取得に失敗:", error);
  }
  return {
    id: userId,
    email: fallbackEmail,
    username: null,
    profileImageUrl: null,
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const supabase = useMemo(() => getClientSupabase(), []);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;

    const applySession = async (session: Session | null) => {
      if (session?.user) {
        const profile = await fetchProfile(
          session.user.id,
          session.user.email ?? null,
        );
        if (mountedRef.current) {
          setUser(profile);
        }
      } else if (mountedRef.current) {
        setUser(null);
      }
    };

    const initialize = async () => {
      const { data } = await supabase.auth.getSession();
      await applySession((data.session ?? null) as Session | null);
      if (mountedRef.current) {
        setIsInitializing(false);
      }
    };
    void initialize();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(
      (_event: AuthChangeEvent, session: Session | null) => {
        void applySession(session);
      },
    );

    return () => {
      mountedRef.current = false;
      subscription.unsubscribe();
    };
  }, [supabase]);

  const signInWithCredentials = useCallback(
    async ({ email, password }: Credentials) => {
      setIsProcessing(true);
      try {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) {
          throw new Error(error.message);
        }
      } finally {
        setIsProcessing(false);
      }
    },
    [supabase],
  );

  const signUp = useCallback(
    async ({ email, password, username }: SignUpInput) => {
      setIsProcessing(true);
      try {
        // backend 経由で Supabase Auth ユーザー + public."User" profile を作成
        const result = await trpcClient.users.create.mutate({
          email,
          password,
          username,
        });
        if (!result.success) {
          throw new Error(result.error ?? "新規登録に失敗しました");
        }
        // 作成直後にログインして session を確立
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) {
          throw new Error(error.message);
        }
      } finally {
        setIsProcessing(false);
      }
    },
    [supabase],
  );

  const signOut = useCallback(async () => {
    setIsProcessing(true);
    try {
      await supabase.auth.signOut();
      if (mountedRef.current) {
        setUser(null);
      }
    } finally {
      setIsProcessing(false);
    }
  }, [supabase]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      isInitializing,
      isProcessing,
      signInWithCredentials,
      signUp,
      signOut,
    }),
    [
      user,
      isInitializing,
      isProcessing,
      signInWithCredentials,
      signUp,
      signOut,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth は <AuthProvider> 配下で呼び出してください");
  }
  return ctx;
}
