import { describe, expect, it, beforeEach, vi } from "vitest";
import {
  clearAppearancePreference,
  getAppearanceStorageKey,
  loadAppearancePreference,
  resetAppearanceMemoryStorage,
  saveAppearancePreference,
} from "./appearance-storage";
import { DEFAULT_THEME_ID } from "./themes";

function setupLocalStorageMock() {
  const values = new Map<string, string>();
  const storageMock: Storage = {
    clear: () => values.clear(),
    getItem: (key: string) => values.get(key) ?? null,
    key: (index: number) => [...values.keys()][index] ?? null,
    get length() {
      return values.size;
    },
    removeItem: (key: string) => {
      values.delete(key);
    },
    setItem: (key: string, value: string) => {
      values.set(key, value);
    },
  };
  Object.defineProperty(window, "localStorage", {
    configurable: true,
    value: storageMock,
  });
  return values;
}

describe("appearance-storage", () => {
  let valuesMap: Map<string, string>;

  beforeEach(() => {
    resetAppearanceMemoryStorage();
    valuesMap = setupLocalStorageMock();
    vi.restoreAllMocks();
  });

  it("generates deterministic scoped storage keys", () => {
    expect(getAppearanceStorageKey("company-123", "user-456")).toBe(
      "careermate-appearance:company-123:user-456",
    );
    expect(getAppearanceStorageKey(null, "user-456")).toBe(
      "careermate-appearance:platform:user-456",
    );
  });

  it("returns default theme when no stored preference exists", () => {
    const result = loadAppearancePreference("c1", "u1");
    expect(result.presetId).toBe(DEFAULT_THEME_ID);
    expect(result.isDefault).toBe(true);
    expect(result.isBlocked).toBe(false);
  });

  it("saves and reloads valid theme preference", () => {
    const saveRes = saveAppearancePreference("c1", "u1", "bright-sky");
    expect(saveRes.success).toBe(true);
    expect(saveRes.isBlocked).toBe(false);

    const loadRes = loadAppearancePreference("c1", "u1");
    expect(loadRes.presetId).toBe("bright-sky");
    expect(loadRes.isDefault).toBe(false);
    expect(loadRes.isBlocked).toBe(false);
  });

  it("isolates preferences between different users and companies", () => {
    saveAppearancePreference("c1", "u1", "bright-sky");
    saveAppearancePreference("c1", "u2", "bright-violet");
    saveAppearancePreference("c2", "u1", "bright-milo");

    expect(loadAppearancePreference("c1", "u1").presetId).toBe("bright-sky");
    expect(loadAppearancePreference("c1", "u2").presetId).toBe("bright-violet");
    expect(loadAppearancePreference("c2", "u1").presetId).toBe("bright-milo");
  });

  it("gracefully falls back to default on malformed JSON", () => {
    const key = getAppearanceStorageKey("c1", "u1");
    valuesMap.set(key, "invalid{json");

    const result = loadAppearancePreference("c1", "u1");
    expect(result.presetId).toBe(DEFAULT_THEME_ID);
    expect(result.isDefault).toBe(true);
  });

  it("falls back to default on unknown schema version", () => {
    const key = getAppearanceStorageKey("c1", "u1");
    valuesMap.set(
      key,
      JSON.stringify({ version: 999, presetId: "bright-sky" }),
    );

    const result = loadAppearancePreference("c1", "u1");
    expect(result.presetId).toBe(DEFAULT_THEME_ID);
    expect(result.isDefault).toBe(true);
  });

  it("falls back to default on unknown preset ID", () => {
    const key = getAppearanceStorageKey("c1", "u1");
    valuesMap.set(
      key,
      JSON.stringify({ version: 1, presetId: "neon-cyan-dark" }),
    );

    const result = loadAppearancePreference("c1", "u1");
    expect(result.presetId).toBe(DEFAULT_THEME_ID);
    expect(result.isDefault).toBe(true);
  });

  it("clears saved preference on demand", () => {
    saveAppearancePreference("c1", "u1", "bright-violet");
    expect(loadAppearancePreference("c1", "u1").presetId).toBe("bright-violet");

    clearAppearancePreference("c1", "u1");
    expect(loadAppearancePreference("c1", "u1").presetId).toBe(DEFAULT_THEME_ID);
  });

  it("handles blocked localStorage gracefully via in-memory storage", () => {
    Object.defineProperty(window, "localStorage", {
      configurable: true,
      value: {
        clear: () => {},
        getItem: () => {
          throw new DOMException("The operation is insecure.", "SecurityError");
        },
        setItem: () => {
          throw new DOMException("The operation is insecure.", "SecurityError");
        },
        removeItem: () => {
          throw new DOMException("The operation is insecure.", "SecurityError");
        },
        key: () => null,
        length: 0,
      } satisfies Storage,
    });

    // Save should succeed in memory and report isBlocked
    const saveRes = saveAppearancePreference("blocked-corp", "user-x", "bright-sky");
    expect(saveRes.success).toBe(true);
    expect(saveRes.isBlocked).toBe(true);

    // Load should read from in-memory fallback
    const loadRes = loadAppearancePreference("blocked-corp", "user-x");
    expect(loadRes.presetId).toBe("bright-sky");
    expect(loadRes.isBlocked).toBe(true);
  });

  it("preserves in-memory choice across remounts when localStorage write fails (write-only failure)", () => {
    // getItem succeeds without throwing, but setItem fails (e.g. quota or permissions)
    Object.defineProperty(window, "localStorage", {
      configurable: true,
      value: {
        clear: () => valuesMap.clear(),
        getItem: (key: string) => valuesMap.get(key) ?? null,
        setItem: () => {
          throw new DOMException("Quota exceeded", "QuotaExceededError");
        },
        removeItem: (key: string) => {
          valuesMap.delete(key);
        },
        key: () => null,
        length: 0,
      } satisfies Storage,
    });

    const saveRes = saveAppearancePreference("c1", "u1", "bright-sky");
    expect(saveRes.success).toBe(true);
    expect(saveRes.isBlocked).toBe(true);

    // On remount / subsequent load, memory choice is preserved even though getItem does not throw
    const loadRes = loadAppearancePreference("c1", "u1");
    expect(loadRes.presetId).toBe("bright-sky");
    expect(loadRes.isBlocked).toBe(true);
    expect(loadRes.isDefault).toBe(false);
  });

  it("preserves in-memory reset to default when localStorage remove fails (remove-only failure)", () => {
    // Pre-populate localStorage with a saved preset
    const key = getAppearanceStorageKey("c1", "u1");
    valuesMap.set(key, JSON.stringify({ version: 1, presetId: "bright-violet" }));

    // removeItem throws error, but getItem works
    Object.defineProperty(window, "localStorage", {
      configurable: true,
      value: {
        clear: () => valuesMap.clear(),
        getItem: (k: string) => valuesMap.get(k) ?? null,
        setItem: (k: string, v: string) => valuesMap.set(k, v),
        removeItem: () => {
          throw new DOMException("Operation not permitted", "SecurityError");
        },
        key: () => null,
        length: 0,
      } satisfies Storage,
    });

    const clearRes = clearAppearancePreference("c1", "u1");
    expect(clearRes.success).toBe(true);
    expect(clearRes.isBlocked).toBe(true);

    // On remount / subsequent load, default reset is preserved instead of stale localStorage item
    const loadRes = loadAppearancePreference("c1", "u1");
    expect(loadRes.presetId).toBe(DEFAULT_THEME_ID);
    expect(loadRes.isBlocked).toBe(true);
    expect(loadRes.isDefault).toBe(true);
  });
});
