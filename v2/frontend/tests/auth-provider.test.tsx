import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AuthProvider, useAuth } from "@/features/auth/auth-provider";
import { LoginForm } from "@/features/auth/login-form";
import { getCurrentSession, login, logout } from "@/lib/api";
import type { Session } from "@/lib/types";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn() }),
}));

vi.mock("@/lib/api", () => ({
  getCurrentSession: vi.fn(),
  login: vi.fn(),
  logout: vi.fn(),
  ApiError: class ApiError extends Error {},
  DEMO_MODE: true,
}));

const testSession: Session = {
  accessToken: "sensitive-access-token",
  user: {
    id: "employee-1",
    companyId: "company-1",
    companyName: "CareerMate Test",
    email: "employee@careermate.invalid",
    name: "Nhân viên Test",
    title: "Chuyên viên",
    initials: "NT",
    role: "EMPLOYEE",
    permissions: ["roadmap:self"],
  },
};

function AuthActions() {
  const { status, logoutState, signIn, signOut } = useAuth();

  return (
    <div>
      <output aria-label="Trạng thái xác thực">{status}</output>
      <output aria-label="Trạng thái thu hồi">{logoutState}</output>
      <button type="button" onClick={() => void signIn("employee@careermate.invalid", "password")}>
        Test sign in
      </button>
      <button type="button" onClick={() => void signOut()}>
        Test sign out
      </button>
    </div>
  );
}

describe("AuthProvider logout revocation", () => {
  beforeEach(() => {
    const values = new Map<string, string>();
    Object.defineProperty(window, "localStorage", {
      configurable: true,
      value: {
        clear: () => values.clear(),
        getItem: (key: string) => values.get(key) ?? null,
        key: (index: number) => [...values.keys()][index] ?? null,
        get length() { return values.size; },
        removeItem: (key: string) => values.delete(key),
        setItem: (key: string, value: string) => values.set(key, value),
      } satisfies Storage,
    });
    window.localStorage.clear();
    vi.mocked(getCurrentSession).mockReset();
    vi.mocked(login).mockReset();
    vi.mocked(logout).mockReset();
  });

  it("removes persistent bearer state and exposes a retry when server revocation fails", async () => {
    const user = userEvent.setup();
    vi.mocked(login).mockResolvedValue(testSession);
    vi.mocked(logout)
      .mockRejectedValueOnce(new Error("network unavailable"))
      .mockResolvedValueOnce(undefined);

    render(
      <AuthProvider>
        <AuthActions />
        <LoginForm />
      </AuthProvider>,
    );

    await waitFor(() => expect(screen.getByLabelText("Trạng thái xác thực")).toHaveTextContent("anonymous"));
    await user.click(screen.getByRole("button", { name: "Test sign in" }));
    await waitFor(() => expect(screen.getByLabelText("Trạng thái xác thực")).toHaveTextContent("authenticated"));
    expect(window.localStorage.getItem("careermate-v2-session")).toBe(testSession.accessToken);

    await user.click(screen.getByRole("button", { name: "Test sign out" }));

    await waitFor(() => expect(screen.getByLabelText("Trạng thái thu hồi")).toHaveTextContent("failed"));
    expect(window.localStorage.getItem("careermate-v2-session")).toBeNull();
    expect(screen.getByRole("alert")).toHaveTextContent("chưa thể thu hồi phiên trên máy chủ");
    expect(logout).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole("button", { name: "Thử thu hồi lại" }));

    await waitFor(() => expect(screen.getByLabelText("Trạng thái thu hồi")).toHaveTextContent("idle"));
    expect(logout).toHaveBeenCalledTimes(2);
    expect(logout).toHaveBeenLastCalledWith(testSession.accessToken);
    expect(window.localStorage.getItem("careermate-v2-session")).toBeNull();
    expect(screen.queryByText("Trạng thái đăng xuất")).not.toBeInTheDocument();
  });
});
