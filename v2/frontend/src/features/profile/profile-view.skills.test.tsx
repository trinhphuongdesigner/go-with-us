import { render as renderWithTestingLibrary, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import userEvent from "@testing-library/user-event";
import type { ReactElement } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ProfileView } from "@/features/profile/profile-view";
import { SkillsEditor } from "@/features/profile/skills-editor";
import {
  ApiError,
  apiRequest,
  getOwnProfile,
  replaceEmployeeSkills,
  type CoreProfile,
} from "@/lib/api";

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
  DEMO_MODE: false,
  apiRequest: vi.fn(),
  getOwnProfile: vi.fn(),
  replaceEmployeeSkills: vi.fn(),
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
    skills: [
      {
        id: "employee-skill-react",
        skillId: "skill-react",
        name: "React",
        category: "Frontend",
        level: 2,
        note: "Old note",
        selfAssessed: true,
        sourceType: "SELF",
      },
    ],
    experiences: [],
    projects: [],
    certifications: [],
    awards: [],
    employments: [],
    timeline: [],
  };
}

function render(ui: ReactElement) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return renderWithTestingLibrary(
    <QueryClientProvider client={client}>{ui}</QueryClientProvider>,
  );
}

describe("SkillsEditor and ProfileView skill replacement", () => {
  beforeEach(() => {
    vi.mocked(apiRequest).mockReset();
    vi.mocked(getOwnProfile).mockReset();
    vi.mocked(replaceEmployeeSkills).mockReset();
  });

  it("keeps catalog additions, removals, rating and note changes in draft until Save", async () => {
    vi.mocked(apiRequest).mockResolvedValue({
      items: [
        { id: "skill-react", name: "React", category: "Frontend" },
        { id: "skill-typescript", name: "TypeScript", category: "Frontend" },
      ],
      total: 2,
      page: 1,
      pageSize: 200,
    });
    const onSave = vi.fn();
    render(
      <SkillsEditor
        profile={baseProfile()}
        stale={false}
        pending={false}
        error={false}
        onSave={onSave}
      />,
    );
    const user = userEvent.setup();

    await screen.findByRole("option", { name: "TypeScript · Frontend" });
    await user.selectOptions(screen.getByLabelText("Chọn từ danh mục"), "skill-typescript");
    await user.click(screen.getByRole("button", { name: "Thêm vào hồ sơ" }));
    await user.click(screen.getByRole("button", { name: "Xóa React khỏi bản nháp" }));
    await user.clear(screen.getByLabelText("Mức TypeScript"));
    await user.type(screen.getByLabelText("Mức TypeScript"), "5");
    await user.type(screen.getByLabelText("Ghi chú cho TypeScript"), "  Dùng trong production  ");

    expect(onSave).not.toHaveBeenCalled();
    expect(screen.getByText(/Thay đổi chưa được lưu/)).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Lưu toàn bộ kỹ năng" }));

    expect(onSave).toHaveBeenCalledWith([
      { skillId: "skill-typescript", rating: 5, note: "Dùng trong production" },
    ]);
  });

  it("creates a normalized catalog option but does not persist the profile before Save", async () => {
    vi.mocked(apiRequest).mockImplementation(async (path, init) => {
      if (init?.method === "POST") {
        return { id: "skill-research", name: "User research", category: "Discovery" } as never;
      }
      if (path.includes("/skills-competency/skills?page=")) {
        return { items: [], total: 0, page: 1, pageSize: 200 } as never;
      }
      throw new Error(`Unexpected request ${path}`);
    });
    const onSave = vi.fn();
    render(
      <SkillsEditor
        profile={{ ...baseProfile(), skills: [] }}
        stale={false}
        pending={false}
        error={false}
        onSave={onSave}
      />,
    );
    const user = userEvent.setup();

    await user.type(screen.getByLabelText("Hoặc tên kỹ năng mới"), "  User research  ");
    await user.type(screen.getByLabelText("Nhóm kỹ năng (không bắt buộc)"), "  Discovery  ");
    await user.click(screen.getByRole("button", { name: "Tạo / chọn kỹ năng theo tên" }));

    await screen.findByText(/Đã thêm User research vào bản nháp/);
    expect(onSave).not.toHaveBeenCalled();
    const postCall = vi.mocked(apiRequest).mock.calls.find(([, init]) => init?.method === "POST");
    expect(postCall?.[0]).toBe("/skills-competency/skills");
    expect(JSON.parse(String(postCall?.[1]?.body))).toEqual({
      name: "User research",
      category: "Discovery",
    });

    await user.click(screen.getByRole("button", { name: "Lưu toàn bộ kỹ năng" }));
    expect(onSave).toHaveBeenCalledWith([
      { skillId: "skill-research", rating: 1, note: null },
    ]);
  });

  it("shows catalog failures and blocks invalid non-integer or out-of-range ratings", async () => {
    vi.mocked(apiRequest).mockRejectedValue(new Error("catalog unavailable"));
    const onSave = vi.fn();
    render(
      <SkillsEditor
        profile={baseProfile()}
        stale={false}
        pending={false}
        error={false}
        onSave={onSave}
      />,
    );
    const user = userEvent.setup();

    expect(await screen.findByRole("alert")).toHaveTextContent("catalog unavailable");
    const rating = screen.getByLabelText("Mức React");
    const save = screen.getByRole("button", { name: "Lưu toàn bộ kỹ năng" });
    await user.clear(rating);
    await user.type(rating, "3.5");
    expect(save).toBeDisabled();
    await user.clear(rating);
    await user.type(rating, "6");
    expect(save).toBeDisabled();
    await user.clear(rating);
    await user.type(rating, "5");
    expect(save).toBeEnabled();
    expect(onSave).not.toHaveBeenCalled();
  });

  it("loads later catalog pages when the catalog contains more than 200 skills", async () => {
    vi.mocked(apiRequest).mockImplementation(async (path) => {
      if (path.includes("page=2")) {
        return {
          items: [{ id: "skill-205", name: "Skill 205", category: "Other" }],
          total: 205,
          page: 2,
          pageSize: 200,
        } as never;
      }
      return {
        items: [{ id: "skill-001", name: "Skill 001", category: "Core" }],
        total: 205,
        page: 1,
        pageSize: 200,
      } as never;
    });
    render(
      <SkillsEditor
        profile={{ ...baseProfile(), skills: [] }}
        stale={false}
        pending={false}
        error={false}
        onSave={vi.fn()}
      />,
    );
    const user = userEvent.setup();

    expect(await screen.findByText("Trang 1 / 2")).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Trang sau" }));
    expect(await screen.findByRole("option", { name: "Skill 205 · Other" })).toBeVisible();
    expect(vi.mocked(apiRequest)).toHaveBeenCalledWith(
      "/skills-competency/skills?page=2&pageSize=200",
      undefined,
      "actual-session-token",
    );
  });

  it("keeps the current skill draft visible when a non-conflict save fails", async () => {
    const profile = baseProfile();
    vi.mocked(apiRequest).mockResolvedValue({
      items: [{ id: "skill-react", name: "React", category: "Frontend" }],
      total: 1,
      page: 1,
      pageSize: 200,
    });
    vi.mocked(getOwnProfile).mockResolvedValue(profile);
    vi.mocked(replaceEmployeeSkills).mockRejectedValue(
      new ApiError("Máy chủ tạm thời gián đoạn", 503),
    );

    render(<ProfileView />);
    await screen.findByText("React");
    const user = userEvent.setup();
    const note = screen.getByLabelText("Ghi chú cho React");
    await user.clear(note);
    await user.type(note, "Draft must stay");
    await user.click(screen.getByRole("button", { name: "Lưu toàn bộ kỹ năng" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Chưa thể lưu kỹ năng");
    expect(screen.getByLabelText("Ghi chú cho React")).toHaveValue("Draft must stay");
    expect(screen.queryByText("Hồ sơ đã thay đổi ở nơi khác")).not.toBeInTheDocument();
  });

  it("locks a stale draft on 409 and reload remounts skills from the fresh profile version", async () => {
    const profile = baseProfile();
    const reloadedProfile: CoreProfile = {
      ...profile,
      profileVersion: 4,
      skills: [{ ...profile.skills[0], level: 4, note: "Server note" }],
    };
    vi.mocked(apiRequest).mockResolvedValue({
      items: [{ id: "skill-react", name: "React", category: "Frontend" }],
      total: 1,
      page: 1,
      pageSize: 200,
    });
    vi.mocked(getOwnProfile).mockResolvedValueOnce(profile);
    vi.mocked(replaceEmployeeSkills).mockRejectedValueOnce(
      new ApiError("Phiên hồ sơ đã thay đổi", 409, {
        detail: "Phiên hồ sơ đã thay đổi",
        currentProfileVersion: 4,
      }),
    );

    render(<ProfileView />);
    await screen.findByText("React");
    const user = userEvent.setup();
    const rating = screen.getByLabelText("Mức React");
    await user.clear(rating);
    await user.type(rating, "5");
    const note = screen.getByLabelText("Ghi chú cho React");
    await user.clear(note);
    await user.type(note, "Stale note");
    await user.click(screen.getByRole("button", { name: "Lưu toàn bộ kỹ năng" }));

    await screen.findByText("Hồ sơ đã thay đổi ở nơi khác");
    expect(screen.getByRole("button", { name: "Lưu toàn bộ kỹ năng" })).toBeDisabled();
    expect(vi.mocked(replaceEmployeeSkills).mock.calls[0][2]).toEqual({
      profileVersion: 3,
      skills: [{ skillId: "skill-react", rating: 5, note: "Stale note" }],
    });

    vi.mocked(getOwnProfile).mockResolvedValue(reloadedProfile);
    await user.click(screen.getByRole("button", { name: "Tải lại hồ sơ" }));
    await waitFor(() => expect(screen.queryByRole("alert")).not.toBeInTheDocument());
    expect(screen.getByLabelText("Mức React")).toHaveValue(4);
    expect(screen.getByLabelText("Ghi chú cho React")).toHaveValue("Server note");
    expect(screen.queryByDisplayValue("Stale note")).not.toBeInTheDocument();

    vi.mocked(replaceEmployeeSkills).mockResolvedValueOnce({
      profileVersion: 5,
      items: [],
    });
    await user.click(screen.getByRole("button", { name: "Lưu toàn bộ kỹ năng" }));
    await waitFor(() => expect(replaceEmployeeSkills).toHaveBeenCalledTimes(2));
    expect(vi.mocked(replaceEmployeeSkills).mock.calls[1][2]).toEqual({
      profileVersion: 4,
      skills: [{ skillId: "skill-react", rating: 4, note: "Server note" }],
    });
    await screen.findByText("Đã lưu toàn bộ kỹ năng");
  });
});
