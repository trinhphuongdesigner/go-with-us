"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";

import { getCurrentSession, login as loginRequest, logout as logoutRequest } from "@/lib/api";
import type { Session } from "@/lib/types";

const SESSION_KEY = "careermate-v2-session";

interface AuthContextValue {
  session: Session | null;
  status: "loading" | "authenticated" | "anonymous";
  logoutState: "idle" | "revoking" | "failed";
  logoutError: string | null;
  signIn: (email: string, password: string) => Promise<Session>;
  signOut: () => Promise<void>;
  retryLogout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [status, setStatus] = useState<AuthContextValue["status"]>("loading");
  const [logoutState, setLogoutState] = useState<AuthContextValue["logoutState"]>("idle");
  const [logoutError, setLogoutError] = useState<string | null>(null);
  const pendingLogoutTokens = useRef<string[]>([]);
  const logoutRevocation = useRef<Promise<void> | null>(null);

  useEffect(() => {
    let cancelled = false;

    const hydrateSession = async () => {
      try {
        const saved = window.localStorage.getItem(SESSION_KEY);
        if (saved) {
          const accessToken = saved.startsWith("{")
            ? (JSON.parse(saved) as { accessToken?: unknown }).accessToken
            : saved;
          if (typeof accessToken !== "string" || !accessToken) throw new Error("Invalid stored session");
          const verifiedSession = await getCurrentSession(accessToken);
          if (cancelled) return;
          window.localStorage.setItem(SESSION_KEY, verifiedSession.accessToken);
          setSession(verifiedSession);
          setStatus("authenticated");
          return;
        }
      } catch {
        window.localStorage.removeItem(SESSION_KEY);
      }
      if (cancelled) return;
      setStatus("anonymous");
    };

    const timer = window.setTimeout(() => void hydrateSession(), 0);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    const nextSession = await loginRequest(email, password);
    window.localStorage.setItem(SESSION_KEY, nextSession.accessToken);
    setSession(nextSession);
    setStatus("authenticated");
    return nextSession;
  }, []);

  const retryLogout = useCallback(async () => {
    if (logoutRevocation.current) {
      await logoutRevocation.current;
      return;
    }

    const revoke = async () => {
      if (pendingLogoutTokens.current.length === 0) {
        setLogoutState("idle");
        setLogoutError(null);
        return;
      }

      setLogoutState("revoking");
      setLogoutError(null);
      while (pendingLogoutTokens.current.length > 0) {
        const pending = pendingLogoutTokens.current;
        pendingLogoutTokens.current = [];
        const failed: string[] = [];
        for (const accessToken of pending) {
          try {
            await logoutRequest(accessToken);
          } catch {
            failed.push(accessToken);
          }
        }

        if (failed.length > 0) {
          pendingLogoutTokens.current = [
            ...failed,
            ...pendingLogoutTokens.current.filter((candidate) => !failed.includes(candidate)),
          ];
          setLogoutState("failed");
          setLogoutError("Đã đăng xuất trên thiết bị này nhưng chưa thể thu hồi phiên trên máy chủ.");
          return;
        }
      }

      setLogoutState("idle");
    };

    const request = revoke();
    logoutRevocation.current = request;
    try {
      await request;
    } finally {
      logoutRevocation.current = null;
    }
  }, []);

  const signOut = useCallback(async () => {
    const currentSession = session;
    window.localStorage.removeItem(SESSION_KEY);
    setSession(null);
    setStatus("anonymous");
    if (
      currentSession
      && !pendingLogoutTokens.current.includes(currentSession.accessToken)
    ) {
      pendingLogoutTokens.current.push(currentSession.accessToken);
    }
    await retryLogout();
  }, [retryLogout, session]);

  const value = useMemo(
    () => ({ session, status, logoutState, logoutError, signIn, signOut, retryLogout }),
    [session, status, logoutState, logoutError, signIn, signOut, retryLogout],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
}
