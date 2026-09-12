import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { FeatureScreen } from "@/features/navigation/feature-screen";
import { PeopleDetailView } from "@/features/people/people-view";
import { ApiError } from "@/lib/api";
import type { Session } from "@/lib/types";

const apiMocks = vi.hoisted(() => ({
  getOwnProfile: vi.fn(),
  updateOwnProfile: vi.fn(),
  createProfileResource: vi.fn(),
  updateProfileResource: vi.fn(),
  deleteProfileResource: vi.fn(),
  replaceEmployeeSkills: vi.fn(),
  listPeople: vi.fn(),
  getPerson: vi.fn(),
  listAvailableCompanies: vi.fn(),
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

const betaAdminSession: Session = {
  accessToken: "test-token-beta-admin",
  user: {
    id: "demo-beta-admin",
    companyId: "company-2",
    companyName: "Beta Labs",
    email: "admin-beta@example.invalid",
    name: "Vũ Thanh Bình",
    title: "People Operations Manager",
    initials: "TB",
    role: "COMPANY_ADMIN",
    permissions: ["dashboard:read", "profile:self", "people:read"],
  },
};

const superSession: Session = {
  accessToken: "test-token-super-admin",
  user: {
    id: "demo-super-admin",
    companyId: null,
    companyName: "CareerMate",
    email: "super@example.invalid",
    name: "Phạm Thu Hà",
    title: "Platform Administrator",
    initials: "TH",
    role: "SUPER_ADMIN",
    permissions: ["dashboard:read", "people:read", "platform:manage"],
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
  skills: [{ id: "employee-skill-1", skillId: "skill-1", name: "Product discovery", level: 4, sourceType: "SELF" }],
  experiences: [{ id: "experience-1", title: "Product Designer", organization: "Acme Việt Nam", startDate: "2024-01-01", endDate: null }],
  projects: [{ id: "project-1", name: "CareerMate", role: "Product Designer", startDate: "2026-06-01", endDate: null }],
  certifications: [],
  awards: [{ id: "award-1", name: "Team Impact", issuer: "Acme Việt Nam", type: "WORK", awardedAt: "2026-01-01", sourceType: "ADMIN" }],
  employments: [],
  timeline: [
    { id: "timeline-1", kind: "PROJECT", title: "Ra mắt CareerMate", subtitle: "Product Designer", startDate: "2026-06-01", endDate: null, sourceType: "IMPORT" },
    { id: "timeline-2", kind: "AWARD", title: "Team Impact", subtitle: "Acme Việt Nam", startDate: "2026-01-01", endDate: null, sourceType: "ADMIN" },
  ],
};

const people = {
  items: [
    { id: "demo-employee", name: "Nguyễn Khánh Linh", jobTitle: "Product Designer", department: "Sản phẩm", initials: "KL", skillCount: 8, profileVersion: 4, updatedAt: "2026-09-11T08:30:00.000Z" },
    { id: "demo-engineer", name: "Lê Hoàng Nam", jobTitle: "Senior Engineer", department: "Kỹ thuật", initials: "HN", skillCount: 11, profileVersion: 7, updatedAt: "2026-09-10T04:00:00.000Z" },
  ],
  total: 2,
  page: 1,
  pageSize: 20,
};

const details = {
  profile: { eyebrow: "Hồ sơ 360°", title: "Hồ sơ năng lực", description: "Hồ sơ cá nhân" },
  people: { eyebrow: "People Intelligence", title: "Đội ngũ", description: "Danh sách nhân sự" },
};

function renderFeature(
  feature: string,
  detail = details.profile,
  initialCompanyId?: string,
  queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } }),
) {
  return render(
    <QueryClientProvider client={queryClient}>
      <FeatureScreen feature={feature} detail={detail} initialCompanyId={initialCompanyId} />
    </QueryClientProvider>,
  );
}

function renderPersonDetail(
  queryClient: QueryClient,
  companyId?: string,
) {
  return render(
    <QueryClientProvider client={queryClient}>
      <PeopleDetailView employeeId="demo-employee" companyId={companyId} />
    </QueryClientProvider>,
  );
}

describe("core profile and tenant roster", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    testSession = employeeSession;
    apiMocks.getOwnProfile.mockResolvedValue(profile);
    apiMocks.updateOwnProfile.mockResolvedValue({ ...profile, profileVersion: 5 });
    apiMocks.createProfileResource.mockResolvedValue({ id: "experience-new" });
    apiMocks.updateProfileResource.mockResolvedValue({ id: "award-1" });
    apiMocks.deleteProfileResource.mockResolvedValue(undefined);
    apiMocks.replaceEmployeeSkills.mockResolvedValue({ profileVersion: 5, items: [] });
    apiMocks.listPeople.mockResolvedValue(people);
    apiMocks.listAvailableCompanies.mockResolvedValue([
      { id: "company-1", name: "Acme Việt Nam" },
      { id: "company-2", name: "Beta Labs" },
    ]);
  });

  it("shows the self-owned profile, timeline and contextual Milo guidance", async () => {
    renderFeature("ho-so");

    expect(await screen.findByRole("heading", { name: "Nguyễn Khánh Linh" })).toBeVisible();
    expect(screen.getByText("Phiên hồ sơ 4")).toBeVisible();
    expect(screen.getByRole("heading", { name: "Dòng thời gian nghề nghiệp" })).toBeVisible();
    expect(screen.getByText("Ra mắt CareerMate")).toBeVisible();
    expect(screen.getByText("HR cập nhật")).toBeVisible();
    expect(screen.getByRole("complementary", { name: "Gợi ý từ Milo" })).toBeVisible();
    expect(screen.getByRole("link", { name: /Nhập hồ sơ từ tài liệu/ })).toHaveAttribute("href", "/ho-so/import");
  });

  it("creates a profile experience with the current aggregate version", async () => {
    const user = userEvent.setup();
    renderFeature("ho-so");

    await user.click(await screen.findByRole("button", { name: "Thêm nội dung hồ sơ" }));
    expect(screen.getByRole("textbox", { name: "Tiêu đề" })).toHaveFocus();
    await user.selectOptions(screen.getByRole("combobox", { name: "Loại nội dung" }), "experiences");
    await user.type(screen.getByRole("textbox", { name: "Tiêu đề" }), "Community Mentor");
    await user.type(screen.getByRole("textbox", { name: "Tổ chức" }), "Tech Community");
    await user.type(screen.getByLabelText("Ngày bắt đầu"), "2025-05-01");
    await user.click(screen.getByRole("button", { name: "Lưu kinh nghiệm" }));

    await waitFor(() => expect(apiMocks.createProfileResource).toHaveBeenCalledWith(
      employeeSession,
      "experiences",
      expect.objectContaining({
        profileVersion: 4,
        title: "Community Mentor",
        organization: "Tech Community",
        startDate: "2025-05-01",
      }),
    ));
    const notice = await screen.findByText("Đã thêm nội dung hồ sơ");
    await waitFor(() => expect(notice.closest('[role="status"]')).toHaveFocus());
  });

  it("submits every project field exposed by the resource contract", async () => {
    const user = userEvent.setup();
    renderFeature("ho-so");

    await user.click(await screen.findByRole("button", { name: "Thêm nội dung hồ sơ" }));
    await user.selectOptions(screen.getByRole("combobox", { name: "Loại nội dung" }), "projects");
    await user.type(screen.getByRole("textbox", { name: "Tên dự án" }), "Career Graph");
    await user.type(screen.getByRole("textbox", { name: "Vai trò" }), "Tech Lead");
    await user.type(screen.getByRole("textbox", { name: "Lĩnh vực" }), "People Analytics");
    await user.type(screen.getByRole("textbox", { name: "Công nghệ, cách nhau bằng dấu phẩy" }), "React, PostgreSQL");
    await user.type(screen.getByRole("textbox", { name: "Đóng góp" }), "Thiết kế kiến trúc");
    await user.type(screen.getByRole("textbox", { name: "Mô tả" }), "Hồ sơ năng lực có cấu trúc");
    await user.type(screen.getByRole("textbox", { name: "URL dự án" }), "https://example.invalid/project");
    await user.type(screen.getByLabelText("Ngày bắt đầu"), "2025-01-01");
    await user.type(screen.getByLabelText("Ngày kết thúc"), "2025-12-01");
    await user.click(screen.getByRole("button", { name: "Lưu dự án" }));

    await waitFor(() => expect(apiMocks.createProfileResource).toHaveBeenCalledWith(
      employeeSession,
      "projects",
      expect.objectContaining({
        profileVersion: 4,
        name: "Career Graph",
        role: "Tech Lead",
        domain: "People Analytics",
        techStack: ["React", "PostgreSQL"],
        contribution: "Thiết kế kiến trúc",
        description: "Hồ sơ năng lực có cấu trúc",
        url: "https://example.invalid/project",
        startDate: "2025-01-01",
        endDate: "2025-12-01",
      }),
    ));
  });

  it("edits and deletes an existing resource with optimistic profile version", async () => {
    const user = userEvent.setup();
    renderFeature("ho-so");

    await user.click(await screen.findByRole("button", { name: "Giải thưởng (1)" }));
    await user.click(screen.getByRole("button", { name: "Chỉnh sửa Team Impact" }));
    const name = screen.getByRole("textbox", { name: "Tên giải thưởng" });
    const issuer = screen.getByRole("textbox", { name: "Đơn vị trao" });
    const awardedAt = screen.getByLabelText("Ngày nhận");
    expect(issuer.compareDocumentPosition(awardedAt) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    await user.clear(name);
    await user.type(name, "Company Impact");
    await user.selectOptions(screen.getByRole("combobox", { name: "Loại" }), "PERSONAL");
    expect(screen.getByRole("option", { name: "Cá nhân" })).toBeVisible();
    await user.type(screen.getByRole("textbox", { name: "URL minh chứng" }), "https://example.invalid/evidence");
    await user.type(screen.getByRole("textbox", { name: "Mô tả" }), "Được đồng nghiệp bình chọn");
    await user.click(screen.getByRole("button", { name: "Lưu giải thưởng" }));

    await waitFor(() => expect(apiMocks.updateProfileResource).toHaveBeenCalledWith(
      employeeSession,
      "awards",
      "award-1",
      expect.objectContaining({
        profileVersion: 4,
        name: "Company Impact",
        type: "PERSONAL",
        description: "Được đồng nghiệp bình chọn",
        evidenceUrl: "https://example.invalid/evidence",
        awardedAt: "2026-01-01",
      }),
    ));

    await user.click(screen.getByRole("button", { name: "Xóa Team Impact" }));
    expect(apiMocks.deleteProfileResource).not.toHaveBeenCalled();
    const confirmDelete = screen.getByRole("button", { name: "Xác nhận xóa Team Impact" });
    expect(confirmDelete).toHaveFocus();
    await user.click(confirmDelete);
    await waitFor(() => expect(apiMocks.deleteProfileResource).toHaveBeenCalledWith(
      employeeSession,
      "awards",
      "award-1",
      4,
    ));
  });

  it("shows a recoverable error when deleting a resource fails", async () => {
    const user = userEvent.setup();
    apiMocks.deleteProfileResource.mockRejectedValue(new ApiError("Mất kết nối", 503));
    renderFeature("ho-so");

    await user.click(await screen.findByRole("button", { name: "Giải thưởng (1)" }));
    await user.click(screen.getByRole("button", { name: "Xóa Team Impact" }));
    await user.click(screen.getByRole("button", { name: "Xác nhận xóa Team Impact" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Chưa thể xóa nội dung");
  });

  it("saves skills as one full-replace command", async () => {
    const user = userEvent.setup();
    renderFeature("ho-so");

    await user.click(await screen.findByRole("button", { name: "Kỹ năng (1)" }));
    const rating = screen.getByRole("spinbutton", { name: "Mức Product discovery" });
    await user.clear(rating);
    await user.type(rating, "5");
    await user.click(screen.getByRole("button", { name: "Lưu toàn bộ kỹ năng" }));

    await waitFor(() => expect(apiMocks.replaceEmployeeSkills).toHaveBeenCalledWith(
      employeeSession,
      "demo-employee",
      { profileVersion: 4, skills: [{ skillId: "skill-1", rating: 5, note: null }] },
    ));
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

  it("lets a user clear an optional job title while updating their name", async () => {
    const user = userEvent.setup();
    renderFeature("ho-so");

    await user.click(await screen.findByRole("button", { name: "Chỉnh sửa hồ sơ" }));
    await user.clear(screen.getByRole("textbox", { name: "Chức danh hiện tại" }));
    await user.click(screen.getByRole("button", { name: "Lưu thay đổi" }));

    await waitFor(() => expect(apiMocks.updateOwnProfile).toHaveBeenCalledWith(
      employeeSession,
      { name: "Nguyễn Khánh Linh", jobTitle: null, profileVersion: 4 },
    ));
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

  it("locks resource creation after a typed demo-compatible conflict", async () => {
    const user = userEvent.setup();
    apiMocks.createProfileResource.mockRejectedValue(new ApiError("Phiên hồ sơ đã thay đổi", 409, {
      detail: "Phiên hồ sơ đã thay đổi",
      currentProfileVersion: 5,
    }));
    renderFeature("ho-so");

    await user.click(await screen.findByRole("button", { name: "Thêm nội dung hồ sơ" }));
    await user.type(screen.getByRole("textbox", { name: "Tiêu đề" }), "Mentor");
    await user.type(screen.getByRole("textbox", { name: "Tổ chức" }), "Community");
    await user.click(screen.getByRole("button", { name: "Lưu kinh nghiệm" }));

    expect(await screen.findByRole("heading", { name: "Hồ sơ đã thay đổi ở nơi khác" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Thêm nội dung hồ sơ" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Chỉnh sửa hồ sơ" })).toBeDisabled();
  });

  it("gives HR a searchable, read-only roster and a specific filtered-empty state", async () => {
    testSession = adminSession;
    apiMocks.listPeople.mockImplementation((_session, query) => Promise.resolve(
      query.q ? { items: [], total: 0, page: 1, pageSize: 20 } : people,
    ));
    const user = userEvent.setup();
    renderFeature("nhan-su", details.people);

    expect(await screen.findByRole("heading", { name: "Đội ngũ Acme Việt Nam" })).toBeVisible();
    expect(screen.getByRole("link", { name: "Xem hồ sơ của Nguyễn Khánh Linh" })).toHaveAttribute("href", "/nhan-su/demo-employee");
    expect(screen.queryByRole("button", { name: /Chỉnh sửa/ })).not.toBeInTheDocument();
    expect(screen.getByRole("searchbox", { name: "Tìm nhân sự" })).toHaveAttribute("type", "text");

    await user.type(screen.getByRole("searchbox", { name: "Tìm nhân sự" }), "không tồn tại");
    await waitFor(() => expect(apiMocks.listPeople).toHaveBeenCalledWith(
      adminSession,
      expect.objectContaining({ q: "không tồn tại", page: 1, pageSize: 20 }),
    ));
    expect(await screen.findByRole("heading", { name: "Không có kết quả phù hợp" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Xóa bộ lọc" })).toBeVisible();
  });

  it("lets a super admin select an explicit company before loading tenant data", async () => {
    testSession = superSession;
    const user = userEvent.setup();
    renderFeature("nhan-su", details.people);

    const selector = await screen.findByRole("combobox", { name: "Chọn doanh nghiệp" });
    expect(await screen.findByRole("heading", { name: "Đội ngũ Acme Việt Nam" })).toBeVisible();
    await waitFor(() => expect(apiMocks.listPeople).toHaveBeenCalledWith(
      superSession,
      expect.objectContaining({ companyId: "company-1" }),
    ));

    await user.selectOptions(selector, "company-2");
    expect(await screen.findByRole("heading", { name: "Đội ngũ Beta Labs" })).toBeVisible();
    await waitFor(() => expect(apiMocks.listPeople).toHaveBeenCalledWith(
      superSession,
      expect.objectContaining({ companyId: "company-2" }),
    ));
  });

  it("removes the previous tenant roster while a newly selected tenant is loading", async () => {
    testSession = superSession;
    let releaseBeta: ((value: typeof people) => void) | undefined;
    const betaPending = new Promise<typeof people>((resolve) => { releaseBeta = resolve; });
    apiMocks.listPeople.mockImplementation((_session, query) => (
      query.companyId === "company-2" ? betaPending : Promise.resolve(people)
    ));
    const user = userEvent.setup();
    renderFeature("nhan-su", details.people);

    expect(await screen.findByRole("link", { name: "Xem hồ sơ của Nguyễn Khánh Linh" })).toBeVisible();
    await user.selectOptions(screen.getByRole("combobox", { name: "Chọn doanh nghiệp" }), "company-2");

    expect(screen.queryByRole("link", { name: "Xem hồ sơ của Nguyễn Khánh Linh" })).not.toBeInTheDocument();
    expect(screen.getByRole("status", { name: "Đang tải danh sách nhân sự" })).toBeVisible();
    releaseBeta?.(people);
  });

  it("ignores a companyId URL override for company admins", async () => {
    testSession = adminSession;
    renderFeature("nhan-su", details.people, "company-2");

    await screen.findByRole("heading", { name: "Đội ngũ Acme Việt Nam" });
    expect(apiMocks.listPeople).toHaveBeenCalledWith(
      adminSession,
      expect.objectContaining({ companyId: "company-1" }),
    );
  });

  it("never reuses a person detail cache entry across tenant sessions", async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false, staleTime: 30_000 }, mutations: { retry: false } },
    });
    const acmeProfile = { ...profile, name: "Nhân sự Acme", companyName: "Acme Việt Nam" };
    let releaseBeta: ((value: typeof profile) => void) | undefined;
    const betaPending = new Promise<typeof profile>((resolve) => { releaseBeta = resolve; });
    apiMocks.getPerson.mockImplementation((session) => (
      session.user.companyId === "company-2" ? betaPending : Promise.resolve(acmeProfile)
    ));

    testSession = adminSession;
    const firstRender = renderPersonDetail(queryClient, "company-2");
    expect(await screen.findByRole("heading", { name: "Nhân sự Acme" })).toBeVisible();
    firstRender.unmount();

    testSession = betaAdminSession;
    renderPersonDetail(queryClient);

    expect(screen.queryByRole("heading", { name: "Nhân sự Acme" })).not.toBeInTheDocument();
    expect(screen.getByRole("status", { name: "Đang tải hồ sơ nhân sự" })).toBeVisible();
    releaseBeta?.({ ...profile, name: "Nhân sự Beta", companyName: "Beta Labs" });
  });

  it("requests later roster pages from the server", async () => {
    testSession = adminSession;
    apiMocks.listPeople.mockImplementation((_session, query) => Promise.resolve({
      ...people,
      total: 21,
      page: query.page,
    }));
    const user = userEvent.setup();
    renderFeature("nhan-su", details.people);

    expect(await screen.findByText("Trang 1/2")).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Trang sau" }));
    await waitFor(() => expect(apiMocks.listPeople).toHaveBeenCalledWith(
      adminSession,
      expect.objectContaining({ page: 2, pageSize: 20 }),
    ));
    expect(await screen.findByText("Trang 2/2")).toBeVisible();
  });

  it("blocks a direct roster visit before requesting tenant data", () => {
    renderFeature("nhan-su", details.people);

    expect(screen.getByRole("heading", { name: "Khu vực này không thuộc vai trò của bạn" })).toBeVisible();
    expect(apiMocks.listPeople).not.toHaveBeenCalled();
  });
});
