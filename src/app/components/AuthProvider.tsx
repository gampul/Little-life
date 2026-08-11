'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type { User } from '@supabase/supabase-js';
import { getSupabase } from '../../lib/supabase';

interface AuthContextValue {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  refreshUser: () => Promise<User | null>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

/** Strict Mode / 다중 구독에서도 /auth/v1/user 네트워크를 1회로 합침 */
let cachedUser: User | null | undefined = undefined;
let sharedGetUserPromise: Promise<User | null> | null = null;

async function getUserOnce(
  supabase: NonNullable<ReturnType<typeof getSupabase>>,
  force = false
): Promise<User | null> {
  if (!force && cachedUser !== undefined) {
    return cachedUser;
  }
  if (!force && sharedGetUserPromise) {
    return sharedGetUserPromise;
  }

  sharedGetUserPromise = supabase.auth.getUser().then(({ data, error }) => {
    const next = error || !data.user ? null : data.user;
    cachedUser = next;
    sharedGetUserPromise = null;
    return next;
  });

  return sharedGetUserPromise;
}

function clearUserCache() {
  cachedUser = undefined;
  sharedGetUserPromise = null;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const supabase = getSupabase();
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const refreshUser = useCallback(async () => {
    if (!supabase) {
      setUser(null);
      setIsLoading(false);
      return null;
    }

    const next = await getUserOnce(supabase, true);
    setUser(next);
    setIsLoading(false);
    return next;
  }, [supabase]);

  useEffect(() => {
    if (!supabase) {
      setIsLoading(false);
      return;
    }

    let mounted = true;

    // 앱 전역에서 /auth/v1/user 는 여기서 한 번만 호출
    getUserOnce(supabase).then((next) => {
      if (!mounted) return;
      setUser(next);
      setIsLoading(false);
    });

    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      if (!mounted) return;
      // SIGNED_IN / TOKEN_REFRESHED / SIGNED_OUT 등 — 네트워크 getUser 재호출 없이 세션 공유
      if (event === 'SIGNED_OUT') {
        clearUserCache();
        setUser(null);
        setIsLoading(false);
        return;
      }
      cachedUser = session?.user ?? null;
      setUser(session?.user ?? null);
      setIsLoading(false);
    });

    return () => {
      mounted = false;
      authListener.subscription.unsubscribe();
    };
  }, [supabase]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      isLoading,
      isAuthenticated: !!user,
      refreshUser,
    }),
    [user, isLoading, refreshUser]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return ctx;
}
