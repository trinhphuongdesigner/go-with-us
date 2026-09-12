import { StrictMode } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Session } from "@/lib/types";
import { AppearanceProvider, useAppearance } from "./appearance-context";
import { AppearanceSettings } from "./appearance-settings";
import {
  getAppearanceStorageKey,
  resetAppearanceMemoryStorage,
} from "./appearance-storage";
import { DEFAULT_THEME_ID } from "./themes";

// Mock auth hook to control session and status deterministically in tests
let mockAuthValue: {
  session: Session | null;
  status: "loading" | "authenticated" | "anonymous";
  signOut: () => Promise<void>;
} = {
  session: null,
  status: "anonymous",
  signOut: vi.fn(),
};

vi.mock("@/features/auth/auth-provider", () => ({
  useAuth: () => mockAuthValue,
}));

const employeeSessionA: Session = {
  accessToken: "token-emp-a",
  user: {
    id: "emp-a",
    companyId: "company-1",
    companyName: "Acme 1",
    email: "emp.a@test.com",
    name: "Employee A",
    title: "Designer",
    role: "EMPLOYEE",
    permissions: ["dashboard:read"],
    initials: "EA",
  },
};

const employeeSessionB: Session = {
  accessToken: "token-emp-b",
  user: {
    id: "emp-b",
    companyId: "company-2",
    companyName: "Acme 2",
    email: "emp.b@test.com",
    name: "Employee B",
    title: "Developer",
    role: "EMPLOYEE",
    permissions: ["dashboard:read"],
    initials: "EB",
  },
};

const adminSession: Session = {
  accessToken: "token-admin",
  user: {
    id: "admin-1",
    companyId: "company-1",
    companyName: "Acme 1",
    email: "admin@test.com",
    name: "Admin User",
    title: "HR Director",
    role: "COMPANY_ADMIN",
    permissions: ["dashboard:read", "company:manage"],
    initials: "AU",
  },
};

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

function CurrentThemeWatcher() {
  const { currentPresetId, appliedPresetId, previewPresetId, isReady } = useAppearance();
  return (
    <div data-testid="theme-watcher">
      <span data-testid="current-theme">{currentPresetId}</span>
      <span data-testid="applied-theme">{appliedPresetId}</span>
      <span data-testid="preview-theme">{previewPresetId ?? "none"}</span>
      <span data-testid="is-ready">{isReady ? "ready" : "not-ready"}</span>
    </div>
  );
}

describe("Appearance Feature", () => {
  let valuesMap: Map<string, string>;

  beforeEach(() => {
    resetAppearanceMemoryStorage();
    valuesMap = setupLocalStorageMock();
    document.documentElement.removeAttribute("data-theme");
    vi.restoreAllMocks();
  });

  it.each(["BOD", "HR"] as const)("preserves personal appearance for %s", (role) => {
    mockAuthValue = {
      session: { ...employeeSessionA, user: { ...employeeSessionA.user, role } },
      status: "authenticated",
      signOut: vi.fn(),
    };
    render(<AppearanceProvider><AppearanceSettings /><CurrentThemeWatcher /></AppearanceProvider>);
    expect(screen.queryByText("Giao diện quản trị tiêu chuẩn")).not.toBeInTheDocument();
    expect(screen.getByTestId("is-ready")).toHaveTextContent("ready");
  });

  it("applies default Bright Milo when anonymous or loading", () => {
    mockAuthValue = { session: null, status: "anonymous", signOut: vi.fn() };

    render(
      <AppearanceProvider>
        <CurrentThemeWatcher />
      </AppearanceProvider>,
    );

    expect(document.documentElement.getAttribute("data-theme")).toBe(DEFAULT_THEME_ID);
    expect(screen.getByTestId("current-theme").textContent).toBe(DEFAULT_THEME_ID);
    expect(screen.getByTestId("applied-theme").textContent).toBe(DEFAULT_THEME_ID);
  });

  it("locks admins to Bright Milo default and disables customization", () => {
    mockAuthValue = { session: adminSession, status: "authenticated", signOut: vi.fn() };

    render(
      <AppearanceProvider>
        <AppearanceSettings />
        <CurrentThemeWatcher />
      </AppearanceProvider>,
    );

    expect(document.documentElement.getAttribute("data-theme")).toBe(DEFAULT_THEME_ID);
    expect(screen.getByText("Giao diện quản trị tiêu chuẩn")).toBeDefined();

    // Radio inputs should be disabled for admins
    const radios = screen.getAllByRole("radio");
    expect(radios.length).toBe(3);
    for (const radio of radios) {
      expect((radio as HTMLInputElement).disabled).toBe(true);
    }

    // Apply / Cancel / Restore buttons should not be present
    expect(screen.queryByRole("button", { name: /Lưu giao diện/i })).toBeNull();
  });

  it("allows employee to preview without persisting to storage", async () => {
    const user = userEvent.setup();
    mockAuthValue = { session: employeeSessionA, status: "authenticated", signOut: vi.fn() };

    render(
      <AppearanceProvider>
        <AppearanceSettings />
        <CurrentThemeWatcher />
      </AppearanceProvider>,
    );

    const skyRadio = screen.getByLabelText(/Bright Sky/i);
    await user.click(skyRadio);

    // DOM documentElement should immediately update to preview theme
    expect(document.documentElement.getAttribute("data-theme")).toBe("bright-sky");
    expect(screen.getByTestId("current-theme").textContent).toBe("bright-sky");
    expect(screen.getByTestId("preview-theme").textContent).toBe("bright-sky");
    expect(screen.getByTestId("applied-theme").textContent).toBe("bright-milo");

    // LocalStorage should NOT be updated yet
    const key = getAppearanceStorageKey("company-1", "emp-a");
    expect(valuesMap.get(key)).toBeUndefined();

    // Live feedback should announce preview
    expect(screen.getByText("Đang xem trước giao diện: Bright Sky")).toBeDefined();
  });

  it("applies and persists theme on click Apply, disabling button once applied", async () => {
    const user = userEvent.setup();
    mockAuthValue = { session: employeeSessionA, status: "authenticated", signOut: vi.fn() };

    render(
      <AppearanceProvider>
        <AppearanceSettings />
        <CurrentThemeWatcher />
      </AppearanceProvider>,
    );

    const violetRadio = screen.getByLabelText(/Bright Violet/i);
    await user.click(violetRadio);

    const applyButton = screen.getByRole("button", { name: /Lưu giao diện/i });
    expect((applyButton as HTMLButtonElement).disabled).toBe(false);

    await user.click(applyButton);

    // LocalStorage should now contain the schema version and preset ID
    const key = getAppearanceStorageKey("company-1", "emp-a");
    const stored = JSON.parse(valuesMap.get(key) || "{}");
    expect(stored).toEqual({ version: 1, presetId: "bright-violet" });

    // Applied theme should now be bright-violet and preview cleared
    expect(screen.getByTestId("applied-theme").textContent).toBe("bright-violet");
    expect(screen.getByTestId("preview-theme").textContent).toBe("none");
    expect(document.documentElement.getAttribute("data-theme")).toBe("bright-violet");

    // Apply button is disabled when unchanged
    expect((applyButton as HTMLButtonElement).disabled).toBe(true);
  });

  it("cancels preview and reverts to previously applied theme (not necessarily default)", async () => {
    const user = userEvent.setup();
    // Pre-save bright-sky
    const key = getAppearanceStorageKey("company-1", "emp-a");
    valuesMap.set(key, JSON.stringify({ version: 1, presetId: "bright-sky" }));

    mockAuthValue = { session: employeeSessionA, status: "authenticated", signOut: vi.fn() };

    render(
      <AppearanceProvider>
        <AppearanceSettings />
        <CurrentThemeWatcher />
      </AppearanceProvider>,
    );

    expect(screen.getByTestId("applied-theme").textContent).toBe("bright-sky");
    expect(document.documentElement.getAttribute("data-theme")).toBe("bright-sky");

    // Preview bright-violet
    const violetRadio = screen.getByLabelText(/Bright Violet/i);
    await user.click(violetRadio);
    expect(document.documentElement.getAttribute("data-theme")).toBe("bright-violet");

    // Click Cancel preview
    const cancelButton = screen.getByRole("button", { name: /Hủy xem trước/i });
    await user.click(cancelButton);

    // Should revert back to applied bright-sky, NOT default bright-milo
    expect(document.documentElement.getAttribute("data-theme")).toBe("bright-sky");
    expect(screen.getByTestId("current-theme").textContent).toBe("bright-sky");
    expect(screen.getByTestId("applied-theme").textContent).toBe("bright-sky");
    expect(screen.getByTestId("preview-theme").textContent).toBe("none");
  });

  it("restores Bright Milo default on Restore button click", async () => {
    const user = userEvent.setup();
    const key = getAppearanceStorageKey("company-1", "emp-a");
    valuesMap.set(key, JSON.stringify({ version: 1, presetId: "bright-sky" }));

    mockAuthValue = { session: employeeSessionA, status: "authenticated", signOut: vi.fn() };

    render(
      <AppearanceProvider>
        <AppearanceSettings />
        <CurrentThemeWatcher />
      </AppearanceProvider>,
    );

    const restoreButton = screen.getByRole("button", { name: /Khôi phục.*mặc định/i });
    expect((restoreButton as HTMLButtonElement).disabled).toBe(false);

    await user.click(restoreButton);

    expect(document.documentElement.getAttribute("data-theme")).toBe(DEFAULT_THEME_ID);
    expect(screen.getByTestId("applied-theme").textContent).toBe(DEFAULT_THEME_ID);
    expect(valuesMap.get(key)).toBeUndefined();
  });

  it("cancels unapplied preview when settings unmounts (navigation away)", async () => {
    const user = userEvent.setup();
    mockAuthValue = { session: employeeSessionA, status: "authenticated", signOut: vi.fn() };

    function NavigationHost({ showSettings }: { showSettings: boolean }) {
      return (
        <AppearanceProvider>
          {showSettings ? <AppearanceSettings /> : <div data-testid="other-page">Dashboard</div>}
          <CurrentThemeWatcher />
        </AppearanceProvider>
      );
    }

    const { rerender } = render(<NavigationHost showSettings={true} />);

    const skyRadio = screen.getByLabelText(/Bright Sky/i);
    await user.click(skyRadio);
    expect(document.documentElement.getAttribute("data-theme")).toBe("bright-sky");

    // Navigate away to other page
    rerender(<NavigationHost showSettings={false} />);

    // Theme reverts to applied theme (bright-milo)
    expect(screen.getByTestId("other-page")).toBeDefined();
    expect(document.documentElement.getAttribute("data-theme")).toBe(DEFAULT_THEME_ID);
    expect(screen.getByTestId("current-theme").textContent).toBe(DEFAULT_THEME_ID);
    expect(screen.getByTestId("preview-theme").textContent).toBe("none");
  });

  it("switches theme cleanly on A/B user or tenant change without theme leak", () => {
    // User A has bright-sky
    const keyA = getAppearanceStorageKey("company-1", "emp-a");
    valuesMap.set(keyA, JSON.stringify({ version: 1, presetId: "bright-sky" }));

    // User B has bright-violet
    const keyB = getAppearanceStorageKey("company-2", "emp-b");
    valuesMap.set(keyB, JSON.stringify({ version: 1, presetId: "bright-violet" }));

    // Render with User A
    mockAuthValue = { session: employeeSessionA, status: "authenticated", signOut: vi.fn() };
    const { rerender } = render(
      <AppearanceProvider>
        <CurrentThemeWatcher />
      </AppearanceProvider>,
    );
    expect(document.documentElement.getAttribute("data-theme")).toBe("bright-sky");

    // Switch to User B (tenant and user switch)
    mockAuthValue = { session: employeeSessionB, status: "authenticated", signOut: vi.fn() };
    rerender(
      <AppearanceProvider>
        <CurrentThemeWatcher />
      </AppearanceProvider>,
    );
    expect(document.documentElement.getAttribute("data-theme")).toBe("bright-violet");

    // Switch to Logout
    mockAuthValue = { session: null, status: "anonymous", signOut: vi.fn() };
    rerender(
      <AppearanceProvider>
        <CurrentThemeWatcher />
      </AppearanceProvider>,
    );
    expect(document.documentElement.getAttribute("data-theme")).toBe(DEFAULT_THEME_ID);
  });

  it("enforces default Bright Milo when same user transitions to non-employee role", () => {
    // User emp-a has saved bright-violet
    const keyA = getAppearanceStorageKey("company-1", "emp-a");
    valuesMap.set(keyA, JSON.stringify({ version: 1, presetId: "bright-violet" }));

    // Login as employee emp-a
    mockAuthValue = { session: employeeSessionA, status: "authenticated", signOut: vi.fn() };
    const { rerender } = render(
      <AppearanceProvider>
        <CurrentThemeWatcher />
      </AppearanceProvider>,
    );
    expect(document.documentElement.getAttribute("data-theme")).toBe("bright-violet");
    expect(screen.getByTestId("applied-theme").textContent).toBe("bright-violet");

    // Same user ID and company, but promoted to COMPANY_ADMIN
    const promotedSession: Session = {
      ...employeeSessionA,
      user: {
        ...employeeSessionA.user,
        role: "COMPANY_ADMIN",
      },
    };
    mockAuthValue = { session: promotedSession, status: "authenticated", signOut: vi.fn() };
    rerender(
      <AppearanceProvider>
        <CurrentThemeWatcher />
      </AppearanceProvider>,
    );

    // Theme MUST reset to Bright Milo default for admin
    expect(document.documentElement.getAttribute("data-theme")).toBe(DEFAULT_THEME_ID);
    expect(screen.getByTestId("current-theme").textContent).toBe(DEFAULT_THEME_ID);
    expect(screen.getByTestId("applied-theme").textContent).toBe(DEFAULT_THEME_ID);
  });

  it("renders honest warning banner when storage is blocked", () => {
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

    mockAuthValue = { session: employeeSessionA, status: "authenticated", signOut: vi.fn() };

    render(
      <AppearanceProvider>
        <AppearanceSettings />
      </AppearanceProvider>,
    );

    expect(screen.getByRole("alert")).toBeDefined();
    expect(screen.getByText("Bộ nhớ trình duyệt bị hạn chế")).toBeDefined();
  });

  it("announces temporary-only feedback when storage is blocked on apply and restore", async () => {
    const user = userEvent.setup();
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

    mockAuthValue = { session: employeeSessionA, status: "authenticated", signOut: vi.fn() };

    render(
      <AppearanceProvider>
        <AppearanceSettings />
        <CurrentThemeWatcher />
      </AppearanceProvider>,
    );

    const skyRadio = screen.getByLabelText(/Bright Sky/i);
    await user.click(skyRadio);

    const applyButton = screen.getByRole("button", { name: /Lưu giao diện/i });
    await user.click(applyButton);

    // Should announce temporary-only in live region
    expect(
      screen.getByText(/áp dụng tạm thời.*bộ nhớ.*hạn chế/i),
    ).toBeDefined();

    // Now restore default under blocked storage
    const restoreButton = screen.getByRole("button", { name: /Khôi phục.*mặc định/i });
    await user.click(restoreButton);

    expect(
      screen.getByText(/khôi phục tạm thời.*bộ nhớ.*hạn chế/i),
    ).toBeDefined();
  });

  it("maintains theme consistency across React StrictMode double-mount and remount", () => {
    const keyA = getAppearanceStorageKey("company-1", "emp-a");
    valuesMap.set(keyA, JSON.stringify({ version: 1, presetId: "bright-sky" }));
    mockAuthValue = { session: employeeSessionA, status: "authenticated", signOut: vi.fn() };

    const { unmount } = render(
      <StrictMode>
        <AppearanceProvider>
          <CurrentThemeWatcher />
        </AppearanceProvider>
      </StrictMode>,
    );

    expect(document.documentElement.getAttribute("data-theme")).toBe("bright-sky");
    expect(screen.getByTestId("current-theme").textContent).toBe("bright-sky");

    // Unmount root should restore default theme
    unmount();
    expect(document.documentElement.getAttribute("data-theme")).toBe(DEFAULT_THEME_ID);
  });

  it("resets document theme to Bright Milo on explicit logout transition", () => {
    const keyA = getAppearanceStorageKey("company-1", "emp-a");
    valuesMap.set(keyA, JSON.stringify({ version: 1, presetId: "bright-violet" }));
    mockAuthValue = { session: employeeSessionA, status: "authenticated", signOut: vi.fn() };

    const { rerender } = render(
      <AppearanceProvider>
        <CurrentThemeWatcher />
      </AppearanceProvider>,
    );
    expect(document.documentElement.getAttribute("data-theme")).toBe("bright-violet");

    // Explicit logout transition: session becomes null and status becomes anonymous
    mockAuthValue = { session: null, status: "anonymous", signOut: vi.fn() };
    rerender(
      <AppearanceProvider>
        <CurrentThemeWatcher />
      </AppearanceProvider>,
    );

    expect(document.documentElement.getAttribute("data-theme")).toBe(DEFAULT_THEME_ID);
    expect(screen.getByTestId("current-theme").textContent).toBe(DEFAULT_THEME_ID);
  });
});
