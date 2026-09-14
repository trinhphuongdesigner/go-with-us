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
    projects: [],
    certifications: [],
    awards: [
      {
        id: "award-1",
        name: "Hackathon Winner",
        type: "WORK",
        issuer: "CareerMate",
        description: "Vô địch cuộc thi lập trình nội bộ",
        evidenceUrl: "https://example.invalid/award",
        awardedAt: "2025-01-01",
        sourceType: "SELF",
      },
    ],
    employments: [],
    timeline: [
      {
        id: "award-1",
        kind: "AWARD",
        title: "Hackathon Winner",
        subtitle: "CareerMate",
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

async function openAwardsTab() {
  const user = userEvent.setup();
  await user.click(screen.getByRole("button", { name: /^Giải thưởng/ }));
  return user;
}

describe("ProfileView – Award CRUD", () => {
  beforeEach(() => {
    vi.mocked(getOwnProfile).mockReset();
    vi.mocked(createProfileResource).mockReset();
    vi.mocked(updateProfileResource).mockReset();
    vi.mocked(deleteProfileResource).mockReset();
  });

  it("creates a new award entry with a non-default type, description, evidenceUrl and awardedAt mapped", async () => {
    const profile = baseProfile();
    vi.mocked(getOwnProfile).mockResolvedValue(profile);
    vi.mocked(createProfileResource).mockResolvedValue({
      id: "award-2",
      name: "Employee of the Year",
      type: "PERSONAL",
      issuer: "Acme Corp",
      awardedAt: "2025-06-01",
    } as never);

    render(<ProfileView />);
    await screen.findByText("Hackathon Winner");

    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /Thêm nội dung hồ sơ/ }));
    await user.selectOptions(screen.getByLabelText("Loại nội dung"), "awards");
    await user.type(screen.getByLabelText("Tên giải thưởng"), "Employee of the Year");
    await user.type(screen.getByLabelText("Đơn vị trao"), "Acme Corp");
    await user.type(screen.getByLabelText(/Ngày nhận/), "2025-06-01");
    // Deliberately pick a non-default type (form defaults to WORK when
    // switching into the awards kind) so a handler that ignores the select
    // and always sends WORK would fail this test.
    await user.selectOptions(screen.getByLabelText("Loại"), "PERSONAL");
    await user.type(screen.getByLabelText("Mô tả"), "Ghi nhận đóng góp cả năm");
    await user.type(screen.getByLabelText("URL minh chứng"), "https://example.invalid/eoty");
    await user.click(screen.getByRole("button", { name: "Lưu giải thưởng" }));

    await waitFor(() => expect(createProfileResource).toHaveBeenCalledTimes(1));
    const [, kind, payload] = vi.mocked(createProfileResource).mock.calls[0];
    expect(kind).toBe("awards");
    expect(payload).toMatchObject({
      name: "Employee of the Year",
      issuer: "Acme Corp",
      type: "PERSONAL",
      description: "Ghi nhận đóng góp cả năm",
      evidenceUrl: "https://example.invalid/eoty",
      awardedAt: "2025-06-01",
      profileVersion: 3,
    });
    await screen.findByText("Đã thêm nội dung hồ sơ");
  });

  it("edits an existing award entry and maps every changed Award-specific field on patch", async () => {
    const profile = baseProfile();
    vi.mocked(getOwnProfile).mockResolvedValue(profile);
    vi.mocked(updateProfileResource).mockResolvedValue({
      ...profile.awards[0],
      name: "Hackathon Grand Winner",
    } as never);

    render(<ProfileView />);
    await screen.findByText("Hackathon Winner");
    await openAwardsTab();

    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Chỉnh sửa Hackathon Winner" }));
    const nameInput = screen.getByDisplayValue("Hackathon Winner");
    await user.clear(nameInput);
    await user.type(nameInput, "Hackathon Grand Winner");

    // Also change issuer/type/description/evidenceUrl/awardedAt so the assertion below proves
    // the edit form actually forwards each Award-specific field on patch,
    // not just the shared "name" field.
    const issuerInput = screen.getByDisplayValue("CareerMate");
    await user.clear(issuerInput);
    await user.type(issuerInput, "CareerMate Global");
    await user.selectOptions(screen.getByLabelText("Loại"), "PERSONAL");
    const descriptionInput = screen.getByDisplayValue("Vô địch cuộc thi lập trình nội bộ");
    await user.clear(descriptionInput);
    await user.type(descriptionInput, "Vô địch cuộc thi lập trình toàn quốc");
    const urlInput = screen.getByDisplayValue("https://example.invalid/award");
    await user.clear(urlInput);
    await user.type(urlInput, "https://example.invalid/award-v2");
    const awardedAtInput = screen.getByDisplayValue("2025-01-01");
    await user.clear(awardedAtInput);
    await user.type(awardedAtInput, "2025-02-15");

    await user.click(screen.getByRole("button", { name: "Lưu giải thưởng" }));

    await waitFor(() => expect(updateProfileResource).toHaveBeenCalledTimes(1));
    const [, kind, resourceId, payload] = vi.mocked(updateProfileResource).mock.calls[0];
    expect(kind).toBe("awards");
    expect(resourceId).toBe("award-1");
    expect(payload).toMatchObject({
      name: "Hackathon Grand Winner",
      issuer: "CareerMate Global",
      type: "PERSONAL",
      description: "Vô địch cuộc thi lập trình toàn quốc",
      evidenceUrl: "https://example.invalid/award-v2",
      awardedAt: "2025-02-15",
      profileVersion: 3,
    });
  });

  it("requires a confirmation click before deleting an award", async () => {
    const profile = baseProfile();
    vi.mocked(getOwnProfile).mockResolvedValue(profile);
    vi.mocked(deleteProfileResource).mockResolvedValue(undefined as never);

    render(<ProfileView />);
    await screen.findByText("Hackathon Winner");
    await openAwardsTab();

    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Xóa Hackathon Winner" }));
    expect(deleteProfileResource).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Xác nhận xóa Hackathon Winner" }));

    await waitFor(() => expect(deleteProfileResource).toHaveBeenCalledWith(
      expect.anything(),
      "awards",
      "award-1",
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
    await screen.findByText("Hackathon Winner");
    await openAwardsTab();

    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Xóa Hackathon Winner" }));
    await user.click(screen.getByRole("button", { name: "Xác nhận xóa Hackathon Winner" }));

    await screen.findByRole("alert");
    expect(screen.getByText("Hồ sơ đã thay đổi ở nơi khác")).toBeVisible();
    const editButton = screen.getByRole("button", { name: "Chỉnh sửa Hackathon Winner" });
    expect(editButton).toBeDisabled();
  });

  it("discards a stale draft after a 409 conflict is resolved by reloading, so retry uses the server's current fields", async () => {
    const profile = baseProfile();
    vi.mocked(getOwnProfile).mockResolvedValueOnce(profile);
    vi.mocked(updateProfileResource).mockRejectedValueOnce(
      new ApiError("Phiên bản hồ sơ không khớp", 409, { detail: "stale", currentProfileVersion: 4 }),
    );

    render(<ProfileView />);
    await screen.findByText("Hackathon Winner");
    await openAwardsTab();

    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Chỉnh sửa Hackathon Winner" }));
    const nameInput = screen.getByDisplayValue("Hackathon Winner");
    await user.clear(nameInput);
    await user.type(nameInput, "My Stale Draft");
    await user.click(screen.getByRole("button", { name: "Lưu giải thưởng" }));

    await waitFor(() => expect(updateProfileResource).toHaveBeenCalledTimes(1));
    const [, , , stalePayload] = vi.mocked(updateProfileResource).mock.calls[0];
    expect(stalePayload).toMatchObject({ name: "My Stale Draft", profileVersion: 3 });
    await screen.findByRole("alert");

    // Server moved on concurrently: issuer changed by someone else, version bumped to 4.
    const reloadedProfile: CoreProfile = {
      ...profile,
      profileVersion: 4,
      awards: [{ ...profile.awards[0], issuer: "CareerMate Global" }],
    };
    // Keep returning the current server profile for both the explicit reload
    // and the invalidate/refetch performed after the successful retry.
    vi.mocked(getOwnProfile).mockResolvedValue(reloadedProfile);
    await user.click(screen.getByRole("button", { name: "Tải lại hồ sơ" }));

    // The stale draft editor must not still be open/submittable against v4.
    await waitFor(() => expect(screen.queryByRole("alert")).not.toBeInTheDocument());
    expect(screen.queryByDisplayValue("My Stale Draft")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Lưu giải thưởng" })).not.toBeInTheDocument();

    // Reopening the editor must show the fresh server value, not the discarded draft.
    vi.mocked(updateProfileResource).mockResolvedValueOnce({ ...reloadedProfile.awards[0] } as never);
    await user.click(screen.getByRole("button", { name: "Chỉnh sửa Hackathon Winner" }));
    expect(screen.getByDisplayValue("Hackathon Winner")).toBeInTheDocument();
    expect(screen.getByDisplayValue("CareerMate Global")).toBeInTheDocument();
    expect(screen.queryByDisplayValue("My Stale Draft")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Lưu giải thưởng" }));
    await waitFor(() => expect(updateProfileResource).toHaveBeenCalledTimes(2));
    const [, , , freshPayload] = vi.mocked(updateProfileResource).mock.calls[1];
    expect(freshPayload).toMatchObject({ profileVersion: 4 });
    await screen.findByText("Đã lưu nội dung hồ sơ");
  });
});
