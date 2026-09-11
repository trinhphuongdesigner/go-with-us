'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import * as authApi from '@/lib/api/authApi';
import { getStoredToken, setStoredToken, ApiError } from '@/lib/api/client';
import type { User } from '@/types';
import Loading from '@/components/ui/Loading';

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = React.createContext<AuthContextValue | undefined>(undefined);

/**
 * Wraps the whole app (see app/layout.tsx). Token lives in localStorage
 * (see lib/api/client.ts's header comment for why, at this scaffold
 * stage) — on mount, if a token is present, re-validates it against
 * GET /api/auth/me so a stale/expired token doesn't leave the app in a
 * half-authenticated state.
 */
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = React.useState<User | null>(null);
  // No stored token = nothing to validate, so start "not loading" instead
  // of flipping it off synchronously inside the effect below (React 19's
  // react-hooks/set-state-in-effect lint rule flags that pattern).
  const [loading, setLoading] = React.useState(() => !!getStoredToken());

  React.useEffect(() => {
    const token = getStoredToken();
    if (!token) {
      return;
    }

    authApi
      .me()
      .then(setUser)
      .catch((error) => {
        if (error instanceof ApiError) {
          setStoredToken(null);
        }
        setUser(null);
      })
      .finally(() => setLoading(false));
  }, []);

  const login = React.useCallback(async (email: string, password: string) => {
    const response = await authApi.login(email, password);
    setStoredToken(response.accessToken);
    setUser(response.user);
  }, []);

  const logout = React.useCallback(() => {
    setStoredToken(null);
    setUser(null);
  }, []);

  const value = React.useMemo(() => ({ user, loading, login, logout }), [user, loading, login, logout]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = React.useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

/**
 * Gates children behind an authenticated session — redirects to /login
 * once loading settles with no user. Used by AppShell so every
 * authenticated route gets this for free just by rendering inside it.
 */
export function RequireAuth({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();

  React.useEffect(() => {
    if (!loading && !user) {
      router.replace('/login');
    }
  }, [loading, user, router]);

  if (loading || !user) {
    return <Loading variant="fullscreen" size="lg" />;
  }

  return <>{children}</>;
}
