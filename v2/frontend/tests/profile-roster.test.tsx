import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { FeatureScreen } from "@/features/navigation/feature-screen";
import { ApiError } from "@/lib/api";
import type { Session } from "@/lib/types";

const apiMocks = vi.hoisted(() => ({
  getOwnProfile: vi.fn(),
  updateOwnProfile: vi.fn(),
  listPeople: vi.fn(),
  getPerson: vi.fn(),
}));

let testSession: Session;

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock("@/features/auth/auth-provider", () => ({
  useAuth: () => ({ session: testSession, status: "authenticated" }),
}));

vi.mock("@/lib/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api")>();
  return { ...actual, ...apiMocks };
});

const employeeSession: Session = {
  accessToken: "test-token-employee",
  user: {
    id: "demo-employee",
    companyId: "company-1",
    companyName: "Acme Việt Nam",
    email: "linh@example.invalid",
    name: "Nguyễn Khánh Linh",
    title: "Product Designer",
    initials: "KL",
    role: "EMPLOYEE",
    permissions: ["dashboard:read", "profile:self"],
  },
};

const adminSession: Session = {
  accessToken: "test-token-company-admin",
  user: {
    id: "demo-company-admin",
    companyId: "company-1",
    companyName: "Acme Việt Nam",
    email: "admin@example.invalid",
    name: "Trần Minh An",
    title: "People Operations Manager",
    initials: "MA",
    role: "COMPANY_ADMIN",
    permissions: ["dashboard:read", "profile:self", "people:read"],
  },
};

const profile = {
  id: "demo-employee",
  name: "Nguyễn Khánh Linh",
  jobTitle: "Product Designer",
  initials: "KL",
  companyName: "Acme Việt Nam",
  profileVersion: 4,
  updatedAt: "2026-09-11T08:30:00.000Z",
  skills: [{ id: "skill-1", name: "Product discovery", level: 4, sourceType: "SELF" }],
  experiences: [{ id: "experience-1", title: "Product Designer", organization: "Acme Việt Nam", startDate: "2024-01-01", endDate: null }],
  projects: [{ id: "project-1", name: "CareerMate", role: "Product Designer", startDate: "2026-06-01", endDate: null }],
  certifications: [],
  awards: [],
  timeline: [{ id: "timeline-1", kind: "PROJECT", title: "Ra mắt CareerMate", subtitle: "Product Designer", startDate: "2026-06-01", endDate: null, sourceType: "IMPORT" }],
};

const people = {
  items: [
    { id: "demo-employee", name: "Nguyễn Khánh Linh", jobTitle: "Product Designer", department: "Sản phẩm", initials: "KL", skillCount: 8, profileVersion: 4, updatedAt: "2026-09-11T08:30:00.000Z" },
    { id: "demo-engineer", name: "Lê Hoàng Nam", jobTitle: "Senior Engineer", department: "Kỹ thuật", initials: "HN", skillCount: 11, profileVersion: 7, updatedAt: "2026-09-10T04:00:00.000Z" },
  ],
  total: 2,
};

const details = {
  profile: { eyebrow: "Hồ sơ 360°", title: "Hồ sơ năng lực", description: "Hồ sơ cá nhân" },
  people: { eyebrow: "People Intelligence", title: "Đội ngũ", description: "Danh sách nhân sự" },
};

function renderFeature(feature: string, detail = details.profile) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <FeatureScreen feature={feature} detail={detail} />
    </QueryClientProvider>,
  );
}

describe("core profile and tenant roster", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    testSession = employeeSession;
    apiMocks.getOwnProfile.mockResolvedValue(profile);
    apiMocks.updateOwnProfile.mockResolvedValue({ ...profile, profileVersion: 5 });
    apiMocks.listPeople.mockResolvedValue(people);
  });

  it("shows the self-owned profile, timeline and contextual Milo guidance", async () => {
    renderFeature("ho-so");

    expect(await screen.findByRole("heading", { name: "Nguyễn Khánh Linh" })).toBeVisible();
    expect(screen.getByText("Phiên hồ sơ 4")).toBeVisible();
    expect(screen.getByRole("heading", { name: "Dòng thời gian nghề nghiệp" })).toBeVisible();
    expect(screen.getByText("Ra mắt CareerMate")).toBeVisible();
    expect(screen.getByRole("complementary", { name: "Gợi ý từ Milo" })).toBeVisible();
    expect(screen.getByRole("link", { name: /Nhập hồ sơ từ tài liệu/ })).toHaveAttribute("href", "/ho-so/import");
  });

  it("edits only name and job title with optimistic profile version", async () => {
    const user = userEvent.setup();
    renderFeature("ho-so");

    await user.click(await screen.findByRole("button", { name: "Chỉnh sửa hồ sơ" }));
    const nameInput = screen.getByRole("textbox", { name: "Họ và tên" });
    const titleInput = screen.getByRole("textbox", { name: "Chức danh hiện tại" });
    await user.clear(nameInput);
    await user.type(nameInput, "Nguyễn Khánh Linh Demo");
    await user.clear(titleInput);
    await user.type(titleInput, "Senior Product Designer");
    await user.click(screen.getByRole("button", { name: "Lưu thay đổi" }));

    await waitFor(() => expect(apiMocks.updateOwnProfile).toHaveBeenCalledWith(
      employeeSession,
      { name: "Nguyễn Khánh Linh Demo", jobTitle: "Senior Product Designer", profileVersion: 4 },
    ));
    expect(await screen.findByText("Đã lưu hồ sơ")).toBeVisible();
    expect(screen.getByText("Phiên hồ sơ 5")).toBeVisible();
  });

  it("locks editing after a typed version conflict until a fresh profile is loaded", async () => {
    const user = userEvent.setup();
    apiMocks.updateOwnProfile.mockRejectedValue(new ApiError("Phiên hồ sơ đã thay đổi", 409, {
      detail: "Phiên hồ sơ đã thay đổi",
      currentProfileVersion: 5,
    }));
    renderFeature("ho-so");

    await user.click(await screen.findByRole("button", { name: "Chỉnh sửa hồ sơ" }));
    await user.click(screen.getByRole("button", { name: "Lưu thay đổi" }));

    expect(await screen.findByRole("heading", { name: "Hồ sơ đã thay đổi ở nơi khác" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Lưu thay đổi" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Tải lại hồ sơ" })).toBeVisible();
  });

  it("keeps stale editing locked when refreshing the profile fails", async () => {
    const user = userEvent.setup();
    apiMocks.updateOwnProfile.mockRejectedValue(new ApiError("Phiên hồ sơ đã thay đổi", 409, {
      detail: "Phiên hồ sơ đã thay đổi",
      currentProfileVersion: 5,
    }));
    renderFeature("ho-so");

    await user.click(await screen.findByRole("button", { name: "Chỉnh sửa hồ sơ" }));
    await user.click(screen.getByRole("button", { name: "Lưu thay đổi" }));
    apiMocks.getOwnProfile.mockRejectedValueOnce(new ApiError("Mất kết nối", 503));
    await user.click(await screen.findByRole("button", { name: "Tải lại hồ sơ" }));

    expect(await screen.findByText("Chưa tải được bản mới. Hồ sơ vẫn đang khóa để bảo vệ thay đổi.")).toBeVisible();
    expect(screen.getByRole("button", { name: "Lưu thay đổi" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Tải lại hồ sơ" })).toBeVisible();
  });

  it("gives HR a searchable, read-only roster and a specific filtered-empty state", async () => {
    testSession = adminSession;
    const user = userEvent.setup();
    renderFeature("nhan-su", details.people);

    expect(await screen.findByRole("heading", { name: "Đội ngũ Acme Việt Nam" })).toBeVisible();
    expect(screen.getByRole("link", { name: "Xem hồ sơ của Nguyễn Khánh Linh" })).toHaveAttribute("href", "/nhan-su/demo-employee");
    expect(screen.queryByRole("button", { name: /Chỉnh sửa/ })).not.toBeInTheDocument();

    await user.type(screen.getByRole("searchbox", { name: "Tìm nhân sự" }), "không tồn tại");
    expect(screen.getByRole("heading", { name: "Không có kết quả phù hợp" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Xóa bộ lọc" })).toBeVisible();
  });

  it("blocks a direct roster visit before requesting tenant data", () => {
    renderFeature("nhan-su", details.people);

    expect(screen.getByRole("heading", { name: "Khu vực này không thuộc vai trò của bạn" })).toBeVisible();
    expect(apiMocks.listPeople).not.toHaveBeenCalled();
  });
});
