import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import AssessmentBuilderPage from "@/app/(protected)/cong-ty/tieu-chi/preview/page";
import type { Session } from "@/lib/types";

const mockAuth = {
  session: null as Session | null,
  status: "anonymous" as "loading" | "authenticated" | "anonymous",
  logoutState: "idle" as const,
  logoutError: null,
  signIn: vi.fn(),
  signOut: vi.fn(),
  retryLogout: vi.fn(),
};

vi.mock("@/features/auth/auth-provider", () => ({
  useAuth: () => mockAuth,
}));

describe("AssessmentBuilderPage permission guard", () => {
  it("shows loading indicator when session is still validating", () => {
    mockAuth.status = "loading";
    mockAuth.session = null;

    render(<AssessmentBuilderPage />);

    expect(screen.getByText("Đang xác thực quyền truy cập...")).toBeInTheDocument();
  });

  it("denies access when session is anonymous / null", () => {
    mockAuth.status = "anonymous";
    mockAuth.session = null;

    render(<AssessmentBuilderPage />);

    expect(screen.getByText("Không có quyền truy cập")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Khu vực này không thuộc vai trò của bạn" }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Thiết lập mẫu tiêu chí đánh giá" })).not.toBeInTheDocument();
  });

  it("denies access when user does not have company:manage permission (e.g. Employee)", () => {
    mockAuth.status = "authenticated";
    mockAuth.session = {
      accessToken: "token-employee",
      user: {
        id: "emp-1",
        companyId: "company-1",
        companyName: "Acme Việt Nam",
        email: "linh.nguyen@demo.careermate.vn",
        name: "Nguyễn Khánh Linh",
        title: "Product Designer",
        role: "EMPLOYEE",
        permissions: ["dashboard:read", "profile:self", "roadmap:self", "assessment:self"],
        initials: "KL",
      },
    };

    render(<AssessmentBuilderPage />);

    expect(screen.getByText("Không có quyền truy cập")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Khu vực này không thuộc vai trò của bạn" }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Thiết lập mẫu tiêu chí đánh giá" })).not.toBeInTheDocument();
  });

  it("grants access when user has company:manage permission (e.g. Company Admin)", () => {
    mockAuth.status = "authenticated";
    mockAuth.session = {
      accessToken: "token-admin",
      user: {
        id: "admin-1",
        companyId: "company-1",
        companyName: "Acme Việt Nam",
        email: "hr.manager@demo.careermate.vn",
        name: "Trần Minh An",
        title: "People Operations Manager",
        role: "COMPANY_ADMIN",
        permissions: ["dashboard:read", "profile:self", "roadmap:self", "assessment:self", "company:manage"],
        initials: "MA",
      },
    };

    render(<AssessmentBuilderPage />);

    expect(
      screen.getByRole("heading", { level: 1, name: "Thiết lập mẫu tiêu chí đánh giá" }),
    ).toBeInTheDocument();
    expect(screen.queryByText("Khu vực này không thuộc vai trò của bạn")).not.toBeInTheDocument();
  });
});
