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
    certifications: [
      {
        id: "cert-1",
        name: "AWS Solutions Architect",
        type: "PROFESSIONAL",
        issuer: "Amazon",
        score: "890/1000",
        credentialUrl: "https://example.invalid/credential",
        issuedAt: "2025-01-01",
        expiresAt: "2028-01-01",
        sourceType: "SELF",
      },
    ],
    awards: [],
    employments: [],
    timeline: [
      {
        id: "cert-1",
        kind: "CERTIFICATION",
        title: "AWS Solutions Architect",
        subtitle: "Amazon",
        startDate: "2025-01-01",
        // Must mirror the certification's expiresAt (2028-01-01), not null,
        // so this fixture also validates the aggregate's timeline projection.
        endDate: "2028-01-01",
        sourceType: "SELF",
      },
    ],
  };
}

function render(ui: ReactElement) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return renderWithTestingLibrary(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

async function openCertificationsTab() {
  const user = userEvent.setup();
  await user.click(screen.getByRole("button", { name: /^Chứng chỉ/ }));
  return user;
}

describe("ProfileView – Certification CRUD", () => {
  beforeEach(() => {
    vi.mocked(getOwnProfile).mockReset();
    vi.mocked(createProfileResource).mockReset();
    vi.mocked(updateProfileResource).mockReset();
    vi.mocked(deleteProfileResource).mockReset();
  });

  it("creates a new certification entry with a non-default type, score, issuedAt, expiresAt and credentialUrl mapped", async () => {
    const profile = baseProfile();
    vi.mocked(getOwnProfile).mockResolvedValue(profile);
    vi.mocked(createProfileResource).mockResolvedValue({
      id: "cert-2",
      name: "TOEIC",
      type: "LANGUAGE",
      issuer: "ETS",
      issuedAt: "2025-03-01",
      expiresAt: "2028-03-01",
    } as never);

    render(<ProfileView />);
    await screen.findByText("AWS Solutions Architect");

    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /Thêm nội dung hồ sơ/ }));
    await user.selectOptions(screen.getByLabelText("Loại nội dung"), "certifications");
    await user.type(screen.getByLabelText("Tên chứng chỉ"), "TOEIC");
    await user.type(screen.getByLabelText("Đơn vị cấp"), "ETS");
    await user.type(screen.getByLabelText(/Ngày cấp/), "2025-03-01");
    // Deliberately pick a non-default type so a handler that ignores the
    // select and always sends the PROFESSIONAL default would fail this test.
    await user.selectOptions(screen.getByLabelText("Loại"), "LANGUAGE");
    await user.type(screen.getByLabelText("Điểm / xếp loại"), "945/990");
    await user.type(screen.getByLabelText("Ngày hết hạn"), "2028-03-01");
    await user.type(screen.getByLabelText("URL chứng thực"), "https://example.invalid/toeic");
    await user.click(screen.getByRole("button", { name: "Lưu chứng chỉ" }));

    await waitFor(() => expect(createProfileResource).toHaveBeenCalledTimes(1));
    const [, kind, payload] = vi.mocked(createProfileResource).mock.calls[0];
    expect(kind).toBe("certifications");
    expect(payload).toMatchObject({
      name: "TOEIC",
      issuer: "ETS",
      type: "LANGUAGE",
      score: "945/990",
      credentialUrl: "https://example.invalid/toeic",
      issuedAt: "2025-03-01",
      expiresAt: "2028-03-01",
      profileVersion: 3,
    });
    await screen.findByText("Đã thêm nội dung hồ sơ");
  });

  it("edits an existing certification entry, changing name plus type/score/expiresAt/credentialUrl and preserving the mapping on patch", async () => {
    const profile = baseProfile();
    vi.mocked(getOwnProfile).mockResolvedValue(profile);
    vi.mocked(updateProfileResource).mockResolvedValue({
      ...profile.certifications[0],
      name: "AWS Solutions Architect Professional",
    } as never);

    render(<ProfileView />);
    await screen.findByText("AWS Solutions Architect");
    await openCertificationsTab();

    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Chỉnh sửa AWS Solutions Architect" }));
    const nameInput = screen.getByDisplayValue("AWS Solutions Architect");
    await user.clear(nameInput);
    await user.type(nameInput, "AWS Solutions Architect Professional");

    // Also change type/score/expiresAt/credentialUrl so the assertion below
    // proves the edit form actually forwards each Certification-specific
    // field on patch, not just the shared "name" field.
    await user.selectOptions(screen.getByLabelText("Loại"), "OTHER");
    const scoreInput = screen.getByDisplayValue("890/1000");
    await user.clear(scoreInput);
    await user.type(scoreInput, "950/1000");
    const expiresInput = screen.getByDisplayValue("2028-01-01");
    await user.clear(expiresInput);
    await user.type(expiresInput, "2029-06-01");
    const urlInput = screen.getByDisplayValue("https://example.invalid/credential");
    await user.clear(urlInput);
    await user.type(urlInput, "https://example.invalid/credential-v2");

    await user.click(screen.getByRole("button", { name: "Lưu chứng chỉ" }));

    await waitFor(() => expect(updateProfileResource).toHaveBeenCalledTimes(1));
    const [, kind, resourceId, payload] = vi.mocked(updateProfileResource).mock.calls[0];
    expect(kind).toBe("certifications");
    expect(resourceId).toBe("cert-1");
    expect(payload).toMatchObject({
      name: "AWS Solutions Architect Professional",
      issuer: "Amazon",
      type: "OTHER",
      score: "950/1000",
      credentialUrl: "https://example.invalid/credential-v2",
      issuedAt: "2025-01-01",
      expiresAt: "2029-06-01",
      profileVersion: 3,
    });
  });

  it("requires a confirmation click before deleting a certification", async () => {
    const profile = baseProfile();
    vi.mocked(getOwnProfile).mockResolvedValue(profile);
    vi.mocked(deleteProfileResource).mockResolvedValue(undefined as never);

    render(<ProfileView />);
    await screen.findByText("AWS Solutions Architect");
    await openCertificationsTab();

    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Xóa AWS Solutions Architect" }));
    expect(deleteProfileResource).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Xác nhận xóa AWS Solutions Architect" }));
    await waitFor(() => expect(deleteProfileResource).toHaveBeenCalledWith(
      expect.anything(),
      "certifications",
      "cert-1",
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
    await screen.findByText("AWS Solutions Architect");
    await openCertificationsTab();

    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Xóa AWS Solutions Architect" }));
    await user.click(screen.getByRole("button", { name: "Xác nhận xóa AWS Solutions Architect" }));

    await screen.findByRole("alert");
    expect(screen.getByText("Hồ sơ đã thay đổi ở nơi khác")).toBeVisible();
    const editButton = screen.getByRole("button", { name: "Chỉnh sửa AWS Solutions Architect" });
    expect(editButton).toBeDisabled();
  });

  it("discards a stale draft after a 409 conflict is resolved by reloading, so retry uses the server's current fields", async () => {
    const profile = baseProfile();
    vi.mocked(getOwnProfile).mockResolvedValueOnce(profile);
    vi.mocked(updateProfileResource).mockRejectedValueOnce(
      new ApiError("Phiên bản hồ sơ không khớp", 409, { detail: "stale", currentProfileVersion: 4 }),
    );

    render(<ProfileView />);
    await screen.findByText("AWS Solutions Architect");
    await openCertificationsTab();

    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Chỉnh sửa AWS Solutions Architect" }));
    const nameInput = screen.getByDisplayValue("AWS Solutions Architect");
    await user.clear(nameInput);
    await user.type(nameInput, "My Stale Draft");
    await user.click(screen.getByRole("button", { name: "Lưu chứng chỉ" }));

    await waitFor(() => expect(updateProfileResource).toHaveBeenCalledTimes(1));
    const [, , , stalePayload] = vi.mocked(updateProfileResource).mock.calls[0];
    expect(stalePayload).toMatchObject({ name: "My Stale Draft", profileVersion: 3 });
    await screen.findByRole("alert");

    // Server moved on concurrently: issuer changed by someone else, version bumped to 4.
    const reloadedProfile: CoreProfile = {
      ...profile,
      profileVersion: 4,
      certifications: [{ ...profile.certifications[0], issuer: "AWS Training" }],
    };
    vi.mocked(getOwnProfile).mockResolvedValueOnce(reloadedProfile);
    await user.click(screen.getByRole("button", { name: "Tải lại hồ sơ" }));

    // The stale draft editor must not still be open/submittable against v4.
    await waitFor(() => expect(screen.queryByRole("alert")).not.toBeInTheDocument());
    expect(screen.queryByDisplayValue("My Stale Draft")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Lưu chứng chỉ" })).not.toBeInTheDocument();

    // Reopening the editor must show the fresh server value, not the discarded draft.
    vi.mocked(updateProfileResource).mockResolvedValueOnce({ ...reloadedProfile.certifications[0] } as never);
    await user.click(screen.getByRole("button", { name: "Chỉnh sửa AWS Solutions Architect" }));
    expect(screen.getByDisplayValue("AWS Solutions Architect")).toBeInTheDocument();
    expect(screen.getByDisplayValue("AWS Training")).toBeInTheDocument();
    expect(screen.queryByDisplayValue("My Stale Draft")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Lưu chứng chỉ" }));
    await waitFor(() => expect(updateProfileResource).toHaveBeenCalledTimes(2));
    const [, , , freshPayload] = vi.mocked(updateProfileResource).mock.calls[1];
    expect(freshPayload).toMatchObject({ profileVersion: 4 });
  });
});
