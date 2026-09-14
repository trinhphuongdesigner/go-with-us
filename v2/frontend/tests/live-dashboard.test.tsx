import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { LiveDashboard } from "@/features/dashboard/live-dashboard";
import type { Summary } from "@/features/dashboard/live-dashboard";
import { ApiError, apiRequest } from "@/lib/api";
import type { Session } from "@/lib/types";

vi.mock("@/lib/api", () => ({
  apiRequest: vi.fn(),
  ApiError: class ApiError extends Error {
    constructor(message: string, public readonly status: number) {
      super(message);
      this.name = "ApiError";
    }
  },
  DEMO_MODE: false,
}));

let mockSession: Session | null = null;

vi.mock("@/features/auth/auth-provider", () => ({
  useAuth: () => ({
    session: mockSession,
    status: "authenticated",
  }),
}));

const personalMockData: Summary = {
  personal: true,
  canSwitchView: true,
  currentView: "personal",
  skillCount: 6,
  projectCount: 4,
  roadmapCount: 2,
  milestoneCount: 5,
  completedMilestones: 3,
  taskCount: 10,
  completedTasks: 7,
  overdueMilestones: 1,
  skills: [
    { name: "React / Next.js", rating: 4 },
    { name: "TypeScript", rating: 3 },
  ],
  upcoming: [
    {
      id: "m-1",
      title: "Xây dựng micro-frontend",
      dueDate: "2026-09-10",
      roadmap: "Chuyên sâu Frontend",
      roadmapId: "rm-1",
      roadmapVersion: 2,
      category: "WORK",
      tasks: [
        { id: "t-1", title: "Tích hợp Module Federation", done: false },
        { id: "t-2", title: "Thiết lập bundle analysis", done: true },
      ],
    },
  ],
};

const managementMockData: Summary = {
  personal: false,
  canSwitchView: true,
  currentView: "management",
  people: 28,
  companies: 3,
  activeRoadmaps: 14,
};

function renderDashboard() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <LiveDashboard />
    </QueryClientProvider>
  );
}

describe("LiveDashboard Feature Suite", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSession = {
      accessToken: "mock-token",
      user: {
        id: "u-lead",
        companyId: "c-1",
        companyName: "CareerMate QA",
        email: "lead@careermate.test",
        name: "Nguyễn Văn Lead",
        title: "Trưởng phòng Kỹ thuật",
        initials: "NL",
        role: "BOD",
        permissions: ["people:read", "company:manage"],
      },
    };
  });

  it("renders PersonalDashboard with metrics, Milo Smart Whisper, and countdown urgency badge", async () => {
    vi.mocked(apiRequest).mockResolvedValueOnce(personalMockData);

    renderDashboard();

    // 1. Wait for greeting and metrics
    expect(await screen.findByText(/Chào Nguyễn Văn Lead/i)).toBeInTheDocument();
    expect(screen.getByText("Kỹ năng đã khai báo")).toBeInTheDocument();
    expect(screen.getByText("Chặng đã hoàn thành")).toBeInTheDocument();
    expect(screen.getByText("3/5")).toBeInTheDocument();

    // 2. Milo Smart Whisper alert (overdue chặng)
    expect(screen.getByText(/Milo nhắc nhở/i)).toBeInTheDocument();
    expect(screen.getByText(/Bạn có 1 chặng quá hạn/i)).toBeInTheDocument();

    // 3. Countdown urgency badge and metrics
    expect(screen.getAllByText(/Quá hạn/i).length).toBeGreaterThanOrEqual(2);
  });

  it("shows only the observed skill rating without invented benchmark or gap claims", async () => {
    vi.mocked(apiRequest).mockResolvedValueOnce(personalMockData);
    const user = userEvent.setup();

    renderDashboard();

    const skillRow = await screen.findByRole("button", {
      name: /Xem mức đã ghi nhận của kỹ năng React \/ Next\.js/i,
    });
    await user.click(skillRow);

    expect(await screen.findByText("Mức kỹ năng đã ghi nhận")).toBeInTheDocument();
    expect(screen.getAllByText("4 / 5")).toHaveLength(2);
    expect(screen.getByText(/chỉ phản ánh mức đang được lưu trong hồ sơ/i)).toBeInTheDocument();
    expect(screen.queryByText(/Senior|Tech Lead|khung năng lực nội bộ|khoảng cách đến chuẩn/i)).not.toBeInTheDocument();

    // Close dialog
    const closeBtn = screen.getByRole("button", { name: "Đóng" });
    await user.click(closeBtn);

    await waitFor(() => {
      expect(screen.queryByText("Mức kỹ năng đã ghi nhận")).not.toBeInTheDocument();
    });
  });

  it("locks every quick check-in task until the successful dashboard refetch finishes", async () => {
    mockSession = {
      ...mockSession!,
      user: {
        ...mockSession!.user,
        role: "EMPLOYEE",
        permissions: ["dashboard:read", "roadmap:self"],
      },
    };
    let resolvePatch!: (value: unknown) => void;
    let resolveRefresh!: (value: Summary) => void;
    const patchResponse = new Promise((resolve) => { resolvePatch = resolve; });
    const refreshResponse = new Promise<Summary>((resolve) => { resolveRefresh = resolve; });
    vi.mocked(apiRequest)
      .mockResolvedValueOnce(personalMockData)
      .mockReturnValueOnce(patchResponse)
      .mockReturnValueOnce(refreshResponse);
    const user = userEvent.setup();

    renderDashboard();

    const checkinBtn = await screen.findByRole("button", { name: /Check-in nhanh/i });
    await user.click(checkinBtn);

    expect(await screen.findByText("Check-in tiến độ")).toBeInTheDocument();
    const firstTask = screen.getByRole("button", { name: /Tích hợp Module Federation/i });
    const secondTask = screen.getByRole("button", { name: /Thiết lập bundle analysis/i });
    await user.click(firstTask);

    expect(firstTask).toBeDisabled();
    expect(secondTask).toBeDisabled();
    await user.click(secondTask);
    expect(apiRequest).toHaveBeenCalledWith(
      "/development-plans/me/roadmaps/rm-1/tasks/t-1",
      expect.objectContaining({
        method: "PATCH",
        body: JSON.stringify({ expectedVersion: 2, done: true }),
      }),
      "mock-token"
    );
    expect(apiRequest).toHaveBeenCalledTimes(2);

    resolvePatch({ version: 3 });
    await waitFor(() => expect(apiRequest).toHaveBeenCalledTimes(3));
    expect(secondTask).toBeDisabled();

    resolveRefresh({
      ...personalMockData,
      upcoming: personalMockData.upcoming?.map((milestone) => ({
        ...milestone,
        roadmapVersion: 3,
        tasks: milestone.tasks.map((task) => task.id === "t-1" ? { ...task, done: true } : task),
      })),
    });
    await waitFor(() => expect(secondTask).not.toBeDisabled());
  });

  it("refetches and explains a stale quick check-in after a typed 409", async () => {
    mockSession = {
      ...mockSession!,
      user: {
        ...mockSession!.user,
        role: "EMPLOYEE",
        permissions: ["dashboard:read", "roadmap:self"],
      },
    };
    vi.mocked(apiRequest)
      .mockResolvedValueOnce(personalMockData)
      .mockRejectedValueOnce(new ApiError("Version conflict", 409))
      .mockResolvedValueOnce({
        ...personalMockData,
        upcoming: personalMockData.upcoming?.map((milestone) => ({ ...milestone, roadmapVersion: 3 })),
      });
    const user = userEvent.setup();

    renderDashboard();
    await user.click(await screen.findByRole("button", { name: /Check-in nhanh/i }));
    await user.click(screen.getByRole("button", { name: /Tích hợp Module Federation/i }));

    expect(await screen.findByRole("status")).toHaveTextContent(/dữ liệu lộ trình đã thay đổi/i);
    await waitFor(() => expect(apiRequest).toHaveBeenCalledTimes(3));
  });

  it("does not offer quick check-in to a BOD without roadmap permission", async () => {
    vi.mocked(apiRequest).mockResolvedValueOnce(personalMockData);

    renderDashboard();

    expect(await screen.findByText("Kỹ năng đã khai báo")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Check-in nhanh/i })).not.toBeInTheDocument();
  });

  it("lets a BOD switch views using an accessible segmented control", async () => {
    vi.mocked(apiRequest).mockResolvedValueOnce(personalMockData);
    vi.mocked(apiRequest).mockResolvedValueOnce(managementMockData);
    const user = userEvent.setup();

    renderDashboard();

    const personalButton = await screen.findByRole("button", { name: "Góc nhìn cá nhân", pressed: true });
    const managementButton = screen.getByRole("button", { name: "Góc nhìn quản lý", pressed: false });
    expect(personalButton).toHaveClass("min-h-11");
    expect(managementButton).toHaveClass("min-h-11");
    await user.click(managementButton);

    expect(await screen.findByText("Tài khoản trong phạm vi")).toBeInTheDocument();
    expect(screen.getByText("Tổng lộ trình")).toBeInTheDocument();
    expect(apiRequest).toHaveBeenLastCalledWith("/dashboard?view=management", undefined, "mock-token");
  });

  it("keeps an HR on the personal renderer when the server returns a personal payload", async () => {
    mockSession = {
      ...mockSession!,
      user: { ...mockSession!.user, role: "HR" },
    };
    vi.mocked(apiRequest)
      .mockResolvedValueOnce(personalMockData)
      .mockResolvedValueOnce(personalMockData);
    const user = userEvent.setup();

    renderDashboard();
    await user.click(await screen.findByRole("button", { name: "Góc nhìn quản lý" }));

    expect(await screen.findByText("Kỹ năng đã khai báo")).toBeInTheDocument();
    expect(screen.queryByText("Tài khoản trong phạm vi")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Góc nhìn cá nhân", pressed: true })).toBeInTheDocument();
  });
});
