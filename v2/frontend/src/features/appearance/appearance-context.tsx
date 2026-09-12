"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useState,
  type ReactNode,
} from "react";

import { useAuth } from "@/features/auth/auth-provider";
import { isEmployeeRole, type Session } from "@/lib/types";
import {
  clearAppearancePreference,
  loadAppearancePreference,
  saveAppearancePreference,
  type StorageSaveResult,
} from "./appearance-storage";
import {
  DEFAULT_THEME_ID,
  isThemePresetId,
  THEME_PRESETS,
  type ThemePreset,
  type ThemePresetId,
} from "./themes";

export interface AppearanceContextValue {
  currentPresetId: ThemePresetId;
  appliedPresetId: ThemePresetId;
  previewPresetId: ThemePresetId | null;
  activePreset: ThemePreset;
  isBlocked: boolean;
  isReady: boolean;
  isEmployee: boolean;
  isAdminLocked: boolean;
  previewPreset: (presetId: ThemePresetId) => void;
  applyPreset: (presetId: ThemePresetId) => StorageSaveResult;
  cancelPreview: () => void;
  restoreDefault: () => StorageSaveResult;
}

const AppearanceContext = createContext<AppearanceContextValue | null>(null);

const useIsomorphicLayoutEffect = typeof window !== "undefined" ? useLayoutEffect : useEffect;

function applyThemeToDocument(presetId: ThemePresetId) {
  if (typeof document === "undefined") return;
  document.documentElement.setAttribute("data-theme", presetId);
}

function AppearanceInner({
  children,
  session,
  status,
}: {
  children: ReactNode;
  session: Session | null;
  status: "loading" | "authenticated" | "anonymous";
}) {
  const isEmployee = status === "authenticated" && Boolean(session && isEmployeeRole(session.user.role));
  const isAdminLocked = status === "authenticated" && !isEmployee;

  // Enforce default theme for nonemployees or unauthenticated users; read storage for employees
  const [appliedPresetId, setAppliedPresetId] = useState<ThemePresetId>(() => {
    if (!isEmployee || !session) {
      return DEFAULT_THEME_ID;
    }
    return loadAppearancePreference(session.user.companyId, session.user.id).presetId;
  });

  const [isBlocked, setIsBlocked] = useState<boolean>(() => {
    if (!isEmployee || !session) {
      return false;
    }
    return loadAppearancePreference(session.user.companyId, session.user.id).isBlocked;
  });

  const [previewPresetId, setPreviewPresetId] = useState<ThemePresetId | null>(null);
  const [isReady, setIsReady] = useState<boolean>(false);

  // Effective theme: non-employees are strictly locked to DEFAULT_THEME_ID
  const effectiveAppliedPresetId = isEmployee ? appliedPresetId : DEFAULT_THEME_ID;
  const effectivePreviewPresetId = isEmployee ? previewPresetId : null;
  const currentPresetId = effectivePreviewPresetId ?? effectiveAppliedPresetId;

  // Prepaint synchronization: synchronize DOM before browser paint to avoid flash of wrong theme
  useIsomorphicLayoutEffect(() => {
    applyThemeToDocument(currentPresetId);
    setIsReady(true);
  }, [currentPresetId]);

  const previewPreset = useCallback(
    (presetId: ThemePresetId) => {
      if (!isEmployee) return;
      if (!isThemePresetId(presetId)) return;
      setPreviewPresetId(presetId);
    },
    [isEmployee],
  );

  const cancelPreview = useCallback(() => {
    setPreviewPresetId(null);
  }, []);

  const applyPreset = useCallback(
    (presetId: ThemePresetId): StorageSaveResult => {
      if (!isEmployee || !session) {
        return { success: false, isBlocked: false };
      }
      if (!isThemePresetId(presetId)) {
        return { success: false, isBlocked: false };
      }

      const result = saveAppearancePreference(
        session.user.companyId,
        session.user.id,
        presetId,
      );

      setIsBlocked(result.isBlocked);
      setAppliedPresetId(presetId);
      setPreviewPresetId(null);
      return result;
    },
    [isEmployee, session],
  );

  const restoreDefault = useCallback((): StorageSaveResult => {
    if (!isEmployee || !session) {
      return { success: false, isBlocked: false };
    }

    const result = clearAppearancePreference(
      session.user.companyId,
      session.user.id,
    );

    setIsBlocked(result.isBlocked);
    setAppliedPresetId(DEFAULT_THEME_ID);
    setPreviewPresetId(null);
    return result;
  }, [isEmployee, session]);

  const activePreset = THEME_PRESETS.find((p) => p.id === currentPresetId) ?? THEME_PRESETS[0];

  const value: AppearanceContextValue = {
    currentPresetId,
    appliedPresetId: effectiveAppliedPresetId,
    previewPresetId: effectivePreviewPresetId,
    activePreset,
    isBlocked,
    isReady,
    isEmployee,
    isAdminLocked,
    previewPreset,
    applyPreset,
    cancelPreview,
    restoreDefault,
  };

  return (
    <AppearanceContext.Provider value={value}>
      {children}
    </AppearanceContext.Provider>
  );
}

export function AppearanceProvider({ children }: { children: ReactNode }) {
  const { session, status } = useAuth();
  // Include companyId, userId, role, and status so identity transitions remount cleanly
  const identityKey = session
    ? `${session.user.companyId}:${session.user.id}:${session.user.role}:${status}`
    : `anon-${status}`;

  // Clean up document theme only when root AppearanceProvider unmounts entirely
  useEffect(() => {
    return () => {
      applyThemeToDocument(DEFAULT_THEME_ID);
    };
  }, []);

  return (
    <AppearanceInner key={identityKey} session={session} status={status}>
      {children}
    </AppearanceInner>
  );
}

export function useAppearance(): AppearanceContextValue {
  const context = useContext(AppearanceContext);
  if (!context) {
    throw new Error("useAppearance must be used within an AppearanceProvider");
  }
  return context;
}
