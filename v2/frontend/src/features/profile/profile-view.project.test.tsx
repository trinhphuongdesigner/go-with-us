import { render as renderWithTestingLibrary, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import userEvent from "@testing-library/user-event";
import type { ReactElement } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  ApiError,
  createProfileResource,
  deleteProfileResource,
  getOwnProfile,
  updateProfileResource,
  type CoreProfile,
} from "@/lib/api";
import { ProfileView } from "@/features/profile/profile-view";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn() }),
}));

vi.mock("@/features/auth/auth-provider", () => ({
  useAuth: () => ({
    session: {
      accessToken: "actual-session-token",
      user: { id: "u1", name: "Nguyễn Thử Nghiệm", email: "test@acme.dev", permissions: [] },
    },
  }),
}));

vi.mock("@/features/profile-extensions/profile-extensions-panel", () => ({
  ProfileExtensionsPanel: () => null,
}));
vi.mock("@/features/profile-extensions/employments-panel", () => ({
  EmploymentsPanel: () => null,
}));

vi.mock("@/lib/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api")>()),
  getOwnProfile: vi.fn(),
  createProfileResource: vi.fn(),
  updateProfileResource: vi.fn(),
  deleteProfileResource: vi.fn(),
}));

function baseProfile(): CoreProfile {
  return {
    id: "u1",
    name: "Nguyễn Thử Nghiệm",
    jobTitle: "Kỹ sư phần mềm",
    initials: "NT",
    companyName: "Acme Corp",
    profileVersion: 3,
    updatedAt: "2024-01-01T00:00:00Z",
    skills: [],
    experiences: [],
    projects: [
      {
        id: "proj-1",
        name: "CareerMate",
        role: "Backend Engineer",
        employmentId: null,
        domain: "HR Tech",
        description: "Xây dựng timeline hợp nhất",
        techStack: ["FastAPI", "PostgreSQL"],
        contribution: "Thiết kế profile aggregate",
        url: null,
        startDate: "2025-01-01",
        endDate: null,
        sourceType: "SELF",
      },
    ],
    certifications: [],
    awards: [],
    employments: [],
    timeline: [
      {
        id: "proj-1",
        kind: "PROJECT",
        title: "CareerMate",
        subtitle: "Backend Engineer",
        startDate: "2025-01-01",
        endDate: null,
        sourceType: "SELF",
      },
    ],
  };
}

function render(ui: ReactElement) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return renderWithTestingLibrary(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

async function openProjectsTab() {
  const user = userEvent.setup();
  await user.click(screen.getByRole("button", { name: /^Dự án/ }));
  return user;
}

describe("ProfileView – Project CRUD", () => {
  beforeEach(() => {
    vi.mocked(getOwnProfile).mockReset();
    vi.mocked(createProfileResource).mockReset();
    vi.mocked(updateProfileResource).mockReset();
    vi.mocked(deleteProfileResource).mockReset();
  });

  it("creates a new project entry with a comma-separated tech stack", async () => {
    const profile = baseProfile();
    vi.mocked(getOwnProfile).mockResolvedValue(profile);
    vi.mocked(createProfileResource).mockResolvedValue({
      id: "proj-2",
      name: "Talent Matching",
      role: "Tech Lead",
      startDate: "2025-02-01",
      endDate: null,
    } as never);

    render(<ProfileView />);
    await screen.findByText("CareerMate");

    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /Thêm nội dung hồ sơ/ }));
    await user.selectOptions(screen.getByLabelText("Loại nội dung"), "projects");
    await user.type(screen.getByLabelText("Tên dự án"), "Talent Matching");
    await user.type(screen.getByLabelText("Vai trò"), "Tech Lead");
    await user.type(screen.getByLabelText("Công nghệ, cách nhau bằng dấu phẩy"), "React, TypeScript");
    await user.click(screen.getByRole("button", { name: "Lưu dự án" }));

    await waitFor(() => expect(createProfileResource).toHaveBeenCalledTimes(1));
    const [, kind, payload] = vi.mocked(createProfileResource).mock.calls[0];
    expect(kind).toBe("projects");
    expect(payload).toMatchObject({
      name: "Talent Matching",
      role: "Tech Lead",
      techStack: ["React", "TypeScript"],
      profileVersion: 3,
    });
    await screen.findByText("Đã thêm nội dung hồ sơ");
  });

  it("edits an existing project entry", async () => {
    const profile = baseProfile();
    vi.mocked(getOwnProfile).mockResolvedValue(profile);
    vi.mocked(updateProfileResource).mockResolvedValue({ ...profile.projects[0], name: "CareerMate v2" } as never);

    render(<ProfileView />);
    await screen.findByText("CareerMate");
    await openProjectsTab();

    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Chỉnh sửa CareerMate" }));
    const nameInput = screen.getByDisplayValue("CareerMate");
    await user.clear(nameInput);
    await user.type(nameInput, "CareerMate v2");
    await user.click(screen.getByRole("button", { name: "Lưu dự án" }));

    await waitFor(() => expect(updateProfileResource).toHaveBeenCalledTimes(1));
    const [, kind, resourceId, payload] = vi.mocked(updateProfileResource).mock.calls[0];
    expect(kind).toBe("projects");
    expect(resourceId).toBe("proj-1");
    expect(payload).toMatchObject({ name: "CareerMate v2", profileVersion: 3 });
  });

  it("requires a confirmation click before deleting a project", async () => {
    const profile = baseProfile();
    vi.mocked(getOwnProfile).mockResolvedValue(profile);
    vi.mocked(deleteProfileResource).mockResolvedValue(undefined as never);

    render(<ProfileView />);
    await screen.findByText("CareerMate");
    await openProjectsTab();

    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Xóa CareerMate" }));
    expect(deleteProfileResource).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Xác nhận xóa CareerMate" }));
    await waitFor(() => expect(deleteProfileResource).toHaveBeenCalledWith(
      expect.anything(),
      "projects",
      "proj-1",
      3,
    ));
    await screen.findByText("Đã xóa nội dung hồ sơ");
  });

  it("locks the profile as stale on a 409 version conflict and requires a reload before retrying", async () => {
    const profile = baseProfile();
    vi.mocked(getOwnProfile).mockResolvedValue(profile);
    vi.mocked(deleteProfileResource).mockRejectedValue(
      new ApiError("Phiên bản hồ sơ không khớp", 409, { detail: "stale", currentProfileVersion: 4 }),
    );

    render(<ProfileView />);
    await screen.findByText("CareerMate");
    await openProjectsTab();

    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Xóa CareerMate" }));
    await user.click(screen.getByRole("button", { name: "Xác nhận xóa CareerMate" }));

    await screen.findByRole("alert");
    expect(screen.getByText("Hồ sơ đã thay đổi ở nơi khác")).toBeVisible();
    const editButton = screen.getByRole("button", { name: "Chỉnh sửa CareerMate" });
    expect(editButton).toBeDisabled();
  });

  it("discards a stale draft after a 409 conflict is resolved by reloading, so retry uses the server's current fields", async () => {
    const profile = baseProfile();
    vi.mocked(getOwnProfile).mockResolvedValueOnce(profile);
    vi.mocked(updateProfileResource).mockRejectedValueOnce(
      new ApiError("Phiên bản hồ sơ không khớp", 409, { detail: "stale", currentProfileVersion: 4 }),
    );

    render(<ProfileView />);
    await screen.findByText("CareerMate");
    await openProjectsTab();

    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Chỉnh sửa CareerMate" }));
    const nameInput = screen.getByDisplayValue("CareerMate");
    await user.clear(nameInput);
    await user.type(nameInput, "My Stale Draft");
    await user.click(screen.getByRole("button", { name: "Lưu dự án" }));

    await waitFor(() => expect(updateProfileResource).toHaveBeenCalledTimes(1));
    const [, , , stalePayload] = vi.mocked(updateProfileResource).mock.calls[0];
    expect(stalePayload).toMatchObject({ name: "My Stale Draft", profileVersion: 3 });
    await screen.findByRole("alert");

    // Server moved on concurrently: role changed by someone else, version bumped to 4.
    const reloadedProfile: CoreProfile = {
      ...profile,
      profileVersion: 4,
      projects: [{ ...profile.projects[0], role: "Staff Engineer" }],
    };
    vi.mocked(getOwnProfile).mockResolvedValueOnce(reloadedProfile);
    await user.click(screen.getByRole("button", { name: "Tải lại hồ sơ" }));

    // The stale draft editor must not still be open/submittable against v4.
    await waitFor(() => expect(screen.queryByRole("alert")).not.toBeInTheDocument());
    expect(screen.queryByDisplayValue("My Stale Draft")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Lưu dự án" })).not.toBeInTheDocument();

    // Reopening the editor must show the fresh server value, not the discarded draft.
    vi.mocked(updateProfileResource).mockResolvedValueOnce({ ...reloadedProfile.projects[0] } as never);
    await user.click(screen.getByRole("button", { name: "Chỉnh sửa CareerMate" }));
    expect(screen.getByDisplayValue("CareerMate")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Staff Engineer")).toBeInTheDocument();
    expect(screen.queryByDisplayValue("My Stale Draft")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Lưu dự án" }));
    await waitFor(() => expect(updateProfileResource).toHaveBeenCalledTimes(2));
    const [, , , freshPayload] = vi.mocked(updateProfileResource).mock.calls[1];
    expect(freshPayload).toMatchObject({ profileVersion: 4 });
  });
});
