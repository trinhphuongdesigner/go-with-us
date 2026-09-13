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
    experiences: [
      {
        id: "exp-1",
        title: "Backend Engineer",
        organization: "Acme Corp",
        employmentId: null,
        description: "Xây dựng API",
        startDate: "2022-01-01",
        endDate: null,
        sourceType: "SELF",
      },
    ],
    projects: [],
    certifications: [],
    awards: [],
    employments: [],
    timeline: [
      {
        id: "exp-1",
        kind: "EXPERIENCE",
        title: "Backend Engineer",
        subtitle: "Acme Corp",
        startDate: "2022-01-01",
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

async function openExperienceTab() {
  const user = userEvent.setup();
  await user.click(screen.getByRole("button", { name: /Kinh nghiệm/ }));
  return user;
}

describe("ProfileView – Experience CRUD", () => {
  beforeEach(() => {
    vi.mocked(getOwnProfile).mockReset();
    vi.mocked(createProfileResource).mockReset();
    vi.mocked(updateProfileResource).mockReset();
    vi.mocked(deleteProfileResource).mockReset();
  });

  it("creates a new experience entry and shows a success announcement", async () => {
    const profile = baseProfile();
    vi.mocked(getOwnProfile).mockResolvedValue(profile);
    vi.mocked(createProfileResource).mockResolvedValue({
      id: "exp-2",
      title: "Tech Lead",
      organization: "Acme Corp",
      startDate: "2023-01-01",
      endDate: null,
    } as never);

    render(<ProfileView />);
    await screen.findByText("Backend Engineer");

    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /Thêm nội dung hồ sơ/ }));
    await user.type(screen.getByLabelText("Tiêu đề"), "Tech Lead");
    await user.type(screen.getByLabelText("Tổ chức"), "Acme Corp");
    await user.click(screen.getByRole("button", { name: "Lưu kinh nghiệm" }));

    await waitFor(() => expect(createProfileResource).toHaveBeenCalledTimes(1));
    const [, kind, payload] = vi.mocked(createProfileResource).mock.calls[0];
    expect(kind).toBe("experiences");
    expect(payload).toMatchObject({ title: "Tech Lead", organization: "Acme Corp", profileVersion: 3 });
    await screen.findByText("Đã thêm nội dung hồ sơ");
  });

  it("edits an existing experience entry", async () => {
    const profile = baseProfile();
    vi.mocked(getOwnProfile).mockResolvedValue(profile);
    vi.mocked(updateProfileResource).mockResolvedValue({ ...profile.experiences[0], title: "Senior Backend Engineer" } as never);

    render(<ProfileView />);
    await screen.findByText("Backend Engineer");
    await openExperienceTab();

    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Chỉnh sửa Backend Engineer" }));
    const titleInput = screen.getByDisplayValue("Backend Engineer");
    await user.clear(titleInput);
    await user.type(titleInput, "Senior Backend Engineer");
    await user.click(screen.getByRole("button", { name: "Lưu kinh nghiệm" }));

    await waitFor(() => expect(updateProfileResource).toHaveBeenCalledTimes(1));
    const [, kind, resourceId, payload] = vi.mocked(updateProfileResource).mock.calls[0];
    expect(kind).toBe("experiences");
    expect(resourceId).toBe("exp-1");
    expect(payload).toMatchObject({ title: "Senior Backend Engineer", profileVersion: 3 });
  });

  it("requires a confirmation click before deleting an experience", async () => {
    const profile = baseProfile();
    vi.mocked(getOwnProfile).mockResolvedValue(profile);
    vi.mocked(deleteProfileResource).mockResolvedValue(undefined as never);

    render(<ProfileView />);
    await screen.findByText("Backend Engineer");
    await openExperienceTab();

    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Xóa Backend Engineer" }));
    expect(deleteProfileResource).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Xác nhận xóa Backend Engineer" }));
    await waitFor(() => expect(deleteProfileResource).toHaveBeenCalledWith(
      expect.anything(),
      "experiences",
      "exp-1",
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
    await screen.findByText("Backend Engineer");
    await openExperienceTab();

    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Xóa Backend Engineer" }));
    await user.click(screen.getByRole("button", { name: "Xác nhận xóa Backend Engineer" }));

    await screen.findByRole("alert");
    expect(screen.getByText("Hồ sơ đã thay đổi ở nơi khác")).toBeVisible();
    const editButton = screen.getByRole("button", { name: "Chỉnh sửa Backend Engineer" });
    expect(editButton).toBeDisabled();
  });
});
