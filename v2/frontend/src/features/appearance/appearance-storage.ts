import { DEFAULT_THEME_ID, isThemePresetId, type ThemePresetId } from "./themes";

export const APPEARANCE_SCHEMA_VERSION = 1;

export interface StoredAppearanceData {
  version: number;
  presetId: ThemePresetId;
}

export interface StorageLoadResult {
  presetId: ThemePresetId;
  isBlocked: boolean;
  isDefault: boolean;
}

export interface StorageSaveResult {
  success: boolean;
  isBlocked: boolean;
}

// In-memory overrides for blocked storage (e.g. write-only, remove-only, or full storage failure).
// Value of null indicates an explicit in-memory reset to default.
const memoryOverrides = new Map<string, StoredAppearanceData | null>();

export function resetAppearanceMemoryStorage(): void {
  memoryOverrides.clear();
}

export function getAppearanceStorageKey(companyId: string | null | undefined, userId: string): string {
  const safeCompany = (companyId || "platform").trim();
  const safeUser = (userId || "no-user").trim();
  return `careermate-appearance:${safeCompany}:${safeUser}`;
}

export function loadAppearancePreference(
  companyId: string | null | undefined,
  userId: string,
): StorageLoadResult {
  const key = getAppearanceStorageKey(companyId, userId);

  // 1. Check if an in-memory override exists for this key (from write-only or remove-only failure)
  if (memoryOverrides.has(key)) {
    const override = memoryOverrides.get(key);
    if (
      override &&
      override.version === APPEARANCE_SCHEMA_VERSION &&
      isThemePresetId(override.presetId)
    ) {
      return {
        presetId: override.presetId,
        isBlocked: true,
        isDefault: override.presetId === DEFAULT_THEME_ID,
      };
    }
    // If override is null, user explicitly reset to default during blocked remove
    return { presetId: DEFAULT_THEME_ID, isBlocked: true, isDefault: true };
  }

  // Check if window is available
  if (typeof window === "undefined") {
    return { presetId: DEFAULT_THEME_ID, isBlocked: false, isDefault: true };
  }

  let isBlocked = false;
  let rawData: string | null = null;

  try {
    rawData = window.localStorage.getItem(key);
  } catch {
    isBlocked = true;
  }

  if (isBlocked) {
    return { presetId: DEFAULT_THEME_ID, isBlocked: true, isDefault: true };
  }

  if (!rawData) {
    return { presetId: DEFAULT_THEME_ID, isBlocked: false, isDefault: true };
  }

  try {
    const parsed: unknown = JSON.parse(rawData);
    if (
      typeof parsed === "object" &&
      parsed !== null &&
      "version" in parsed &&
      "presetId" in parsed
    ) {
      const candidate = parsed as { version: unknown; presetId: unknown };
      if (candidate.version === APPEARANCE_SCHEMA_VERSION && isThemePresetId(candidate.presetId)) {
        return {
          presetId: candidate.presetId,
          isBlocked: false,
          isDefault: candidate.presetId === DEFAULT_THEME_ID,
        };
      }
    }
  } catch {
    // Malformed JSON: ignore and fallback to default
  }

  // Corrupt or outdated data fallback
  return { presetId: DEFAULT_THEME_ID, isBlocked: false, isDefault: true };
}

export function saveAppearancePreference(
  companyId: string | null | undefined,
  userId: string,
  presetId: ThemePresetId,
): StorageSaveResult {
  const key = getAppearanceStorageKey(companyId, userId);
  const data: StoredAppearanceData = {
    version: APPEARANCE_SCHEMA_VERSION,
    presetId,
  };

  if (typeof window === "undefined") {
    memoryOverrides.set(key, data);
    return { success: true, isBlocked: true };
  }

  try {
    window.localStorage.setItem(key, JSON.stringify(data));
    memoryOverrides.delete(key);
    return { success: true, isBlocked: false };
  } catch {
    // Storage blocked (write-only or full error): maintain in memory override
    memoryOverrides.set(key, data);
    return { success: true, isBlocked: true };
  }
}

export function clearAppearancePreference(
  companyId: string | null | undefined,
  userId: string,
): StorageSaveResult {
  const key = getAppearanceStorageKey(companyId, userId);

  if (typeof window === "undefined") {
    memoryOverrides.set(key, null);
    return { success: true, isBlocked: true };
  }

  try {
    window.localStorage.removeItem(key);
    memoryOverrides.delete(key);
    return { success: true, isBlocked: false };
  } catch {
    // Storage blocked on remove (remove-only error): maintain in-memory reset
    memoryOverrides.set(key, null);
    return { success: true, isBlocked: true };
  }
}
