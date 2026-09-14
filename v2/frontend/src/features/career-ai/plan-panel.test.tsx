import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Session } from "@/lib/types";
import { ApiError } from "@/lib/api";
import { careerRequest } from "./api";
import { CareerPlanPanel } from "./plan-panel";

vi.mock("./api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./api")>()),
  careerRequest: vi.fn(),
}));

const session: Session = {
  accessToken: "goal-token",
  user: {
    id: "employee-1",
    companyId: "company-1",
    companyName: "Company 1",
    email: "employee@example.test",
    name: "Employee",
    title: "Engineer",
    initials: "E",
    role: "EMPLOYEE",
    permissions: ["roadmap:self"],
  },
};

const goal = {
  id: "goal-1",
  roadmapId: null,
  version: 3,
  title: "Become a staff engineer",
  category: "WORK" as const,
  description: null,
  metric: null,
  targetValue: null,
  currentValue: null,
  progress: 0,
  dueDate: null,
  status: "NOT_STARTED" as const,
  aiSuggested: false,
  createdAt: "2026-09-13T00:00:00Z",
  updatedAt: "2026-09-13T00:00:00Z",
};

function renderPanel() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <CareerPlanPanel session={session} category="WORK" />
    </QueryClientProvider>,
  );
  return client;
}

describe("career goal concurrent editing", () => {
  beforeEach(() => {
    vi.mocked(careerRequest).mockReset().mockImplementation(async (_token, path) => {
      if (path.includes("/goals?")) return [goal];
      if (path.includes("/history?")) return [];
      return { ...goal, version: 4 };
    });
  });

  it("patches against the goal version captured when the editor opened", async () => {
    const client = renderPanel();
    await screen.findByText(goal.title);
    await userEvent.setup().click(screen.getByRole("button", { name: "Sửa" }));

    act(() => {
      client.setQueryData(
        ["career-plan", "employee-1", "WORK", "goals"],
        [{ ...goal, version: 4 }],
      );
    });
    await userEvent.setup().click(screen.getByRole("button", { name: "Lưu mục tiêu" }));

    await waitFor(() => {
      const request = vi
        .mocked(careerRequest)
        .mock.calls.find((call) => call[2] === "PATCH");
      expect(request?.[1]).toBe("/development-plans/goals/goal-1");
      expect(request?.[3]).toEqual(expect.objectContaining({ expectedVersion: 3 }));
    });
  });

  it("deletes against the goal version captured when confirmation opened", async () => {
    const client = renderPanel();
    await screen.findByText(goal.title);
    await userEvent.setup().click(screen.getByRole("button", { name: "Xóa" }));

    act(() => {
      client.setQueryData(
        ["career-plan", "employee-1", "WORK", "goals"],
        [{ ...goal, version: 4 }],
      );
    });
    await userEvent.setup().click(screen.getByRole("button", { name: "Xác nhận xóa" }));

    await waitFor(() => {
      const request = vi
        .mocked(careerRequest)
        .mock.calls.find((call) => call[2] === "DELETE");
      expect(request?.[1]).toBe("/development-plans/goals/goal-1?expected_version=3");
    });
  });

  it("keeps the edit draft, refreshes server data, and resets the conflict before reopening", async () => {
    let serverGoal = goal;
    let rejectPatch = true;
    let goalReads = 0;
    let resolveRefresh!: (value: typeof goal[]) => void;
    const refresh = new Promise<typeof goal[]>((resolve) => { resolveRefresh = resolve; });
    vi.mocked(careerRequest).mockImplementation(async (_token, path, method) => {
      if (path.includes("/goals?")) {
        goalReads += 1;
        return goalReads === 1 ? [serverGoal] : refresh;
      }
      if (path.includes("/history?")) return [];
      if (method === "PATCH" && rejectPatch) {
        rejectPatch = false;
        serverGoal = { ...goal, title: "Server title", version: 4 };
        throw new ApiError("Yêu cầu không thành công", 409, {
          detail: { code: "version_conflict", currentVersion: 4 },
        });
      }
      return { ...serverGoal, version: 5 };
    });
    renderPanel();
    await screen.findByText(goal.title);
    await userEvent.setup().click(screen.getByRole("button", { name: "Sửa" }));
    const title = screen.getByRole("textbox", { name: "Tên mục tiêu" });
    await userEvent.setup().clear(title);
    await userEvent.setup().type(title, "My local draft");

    await userEvent.setup().click(screen.getByRole("button", { name: "Lưu mục tiêu" }));

    await waitFor(() => expect(goalReads).toBe(2));
    expect(screen.getByRole("button", { name: "Hủy" })).toBeDisabled();
    expect(screen.queryByText(/Dữ liệu mới đã được tải lại/)).not.toBeInTheDocument();
    act(() => resolveRefresh([serverGoal]));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Mục tiêu đã thay đổi ở phiên khác. Dữ liệu mới đã được tải lại; bản nháp của bạn vẫn được giữ.",
    );
    expect(title).toHaveValue("My local draft");
    await screen.findByText("Server title");

    await userEvent.setup().click(screen.getByRole("button", { name: "Hủy" }));
    expect(screen.queryByText(/Mục tiêu đã thay đổi ở phiên khác/)).not.toBeInTheDocument();
    await userEvent.setup().click(screen.getByRole("button", { name: "Sửa" }));
    await userEvent.setup().click(screen.getByRole("button", { name: "Lưu mục tiêu" }));

    await waitFor(() => {
      const patches = vi.mocked(careerRequest).mock.calls.filter((call) => call[2] === "PATCH");
      expect(patches).toHaveLength(2);
      expect(patches[1]?.[3]).toEqual(expect.objectContaining({ expectedVersion: 4 }));
    });
  });

  it("keeps stale delete confirmation, refreshes server data, and uses the new version after reopening", async () => {
    let serverGoal = goal;
    let rejectDelete = true;
    vi.mocked(careerRequest).mockImplementation(async (_token, path, method) => {
      if (path.includes("/goals?")) return [serverGoal];
      if (path.includes("/history?")) return [];
      if (method === "DELETE" && rejectDelete) {
        rejectDelete = false;
        serverGoal = { ...goal, title: "Server title", version: 4 };
        throw new ApiError("Yêu cầu không thành công", 409, {
          detail: { code: "version_conflict", currentVersion: 4 },
        });
      }
      return undefined;
    });
    renderPanel();
    await screen.findByText(goal.title);
    await userEvent.setup().click(screen.getByRole("button", { name: "Xóa" }));

    await userEvent.setup().click(screen.getByRole("button", { name: "Xác nhận xóa" }));

    expect(await screen.findByText("Xóa mục tiêu này? Lộ trình liên kết vẫn được giữ.")).toBeInTheDocument();
    expect(screen.getByText(
      "Mục tiêu đã thay đổi ở phiên khác. Dữ liệu mới đã được tải lại; yêu cầu xóa chưa được thực hiện.",
    )).toBeInTheDocument();
    await screen.findByText("Server title");

    await userEvent.setup().click(screen.getByRole("button", { name: "Hủy" }));
    expect(screen.queryByText(/Mục tiêu đã thay đổi ở phiên khác/)).not.toBeInTheDocument();
    await userEvent.setup().click(screen.getByRole("button", { name: "Xóa" }));
    await userEvent.setup().click(screen.getByRole("button", { name: "Xác nhận xóa" }));

    await waitFor(() => {
      const deletes = vi.mocked(careerRequest).mock.calls.filter((call) => call[2] === "DELETE");
      expect(deletes).toHaveLength(2);
      expect(deletes[1]?.[1]).toBe("/development-plans/goals/goal-1?expected_version=4");
    });
  });

  it("keeps the draft and does not claim fresh data when conflict recovery fails", async () => {
    let goalReads = 0;
    vi.mocked(careerRequest).mockImplementation(async (_token, path, method) => {
      if (path.includes("/goals?")) {
        goalReads += 1;
        if (goalReads === 1) return [goal];
        throw new ApiError("Không thể tải mục tiêu", 503);
      }
      if (path.includes("/history?")) return [];
      if (method === "PATCH") {
        throw new ApiError("Yêu cầu không thành công", 409, {
          detail: { code: "version_conflict", currentVersion: 4 },
        });
      }
      return undefined;
    });
    renderPanel();
    await screen.findByText(goal.title);
    await userEvent.setup().click(screen.getByRole("button", { name: "Sửa" }));
    const title = screen.getByRole("textbox", { name: "Tên mục tiêu" });
    await userEvent.setup().clear(title);
    await userEvent.setup().type(title, "My retained draft");

    await userEvent.setup().click(screen.getByRole("button", { name: "Lưu mục tiêu" }));

    expect(await screen.findByText(
      "Mục tiêu đã thay đổi ở phiên khác. Không tải được dữ liệu mới; bản nháp của bạn vẫn được giữ. Hãy thử tải lại trước khi lưu.",
    )).toBeInTheDocument();
    expect(title).toHaveValue("My retained draft");
    expect(screen.queryByText(/Dữ liệu mới đã được tải lại/)).not.toBeInTheDocument();
  });
});

const plan = {
  id: "plan-3",
  category: "WORK" as const,
  version: 3,
  content: "Server plan v3",
  summary: "Server summary v3",
  aiGenerated: false,
  createdAt: "2026-09-13T00:00:00Z",
};

describe("career plan draft snapshots", () => {
  beforeEach(() => {
    vi.mocked(careerRequest).mockReset().mockImplementation(async (_token, path) => {
      if (path.includes("/goals?")) return [];
      if (path.includes("/history?")) return [plan];
      return { ...plan, id: "plan-4", version: 4 };
    });
  });

  it("saves the content, category, and expected version captured when the draft opened", async () => {
    const client = renderPanel();
    await screen.findByText("Server plan v3");
    await userEvent.setup().click(screen.getByRole("button", { name: "Viết / chỉnh sửa kế hoạch" }));
    const content = screen.getByRole("textbox", { name: "Nội dung Markdown — chưa lưu" });
    await userEvent.setup().clear(content);
    await userEvent.setup().type(content, "Local draft based on v3");

    act(() => {
      client.setQueryData(
        ["career-plan", "employee-1", "WORK", "history"],
        [{ ...plan, id: "plan-4", version: 4, content: "Server plan v4" }],
      );
    });
    await userEvent.setup().click(screen.getByRole("button", { name: "Lưu phiên bản" }));

    await waitFor(() => {
      const request = vi.mocked(careerRequest).mock.calls.find((call) => call[2] === "PUT");
      expect(request?.[1]).toBe("/development-plans/me");
      expect(request?.[3]).toEqual({
        content: "Local draft based on v3",
        summary: "Server summary v3",
        aiGenerated: false,
        category: "WORK",
        expectedVersion: 3,
      });
    });
  });

  it("captures the latest history version when an AI proposal arrives", async () => {
    let resolveProposal!: (value: { planMd: string; summary: string }) => void;
    const proposal = new Promise<{ planMd: string; summary: string }>((resolve) => { resolveProposal = resolve; });
    const client = renderPanel();
    await screen.findByText("Server plan v3");
    vi.mocked(careerRequest).mockImplementation(async (_token, path, method) => {
      if (path.includes("/goals?")) return [];
      if (path.includes("/history?")) return [plan];
      if (path.endsWith("/generate")) return proposal;
      if (method === "PUT") return { ...plan, id: "plan-5", version: 5 };
      return undefined;
    });

    await userEvent.setup().click(screen.getByRole("button", { name: "Đề xuất kế hoạch bằng AI" }));
    act(() => {
      client.setQueryData(
        ["career-plan", "employee-1", "WORK", "history"],
        [{ ...plan, id: "plan-4", version: 4, content: "Server plan v4" }],
      );
      resolveProposal({ planMd: "AI proposal", summary: "AI summary" });
    });
    await screen.findByDisplayValue("AI proposal");
    await userEvent.setup().click(screen.getByRole("button", { name: "Lưu phiên bản" }));

    await waitFor(() => {
      const request = vi.mocked(careerRequest).mock.calls.find((call) => call[2] === "PUT");
      expect(request?.[3]).toEqual({
        content: "AI proposal",
        summary: "AI summary",
        aiGenerated: true,
        category: "WORK",
        expectedVersion: 4,
      });
    });
  });

  it("keeps the draft through 409 recovery and reopens against refreshed history", async () => {
    let historyReads = 0;
    let rejectPut = true;
    let resolveRefresh!: (value: typeof plan[]) => void;
    const refresh = new Promise<typeof plan[]>((resolve) => { resolveRefresh = resolve; });
    const refreshedPlan = { ...plan, id: "plan-4", version: 4, content: "Server plan v4", summary: "Server summary v4" };
    vi.mocked(careerRequest).mockImplementation(async (_token, path, method) => {
      if (path.includes("/goals?")) return [];
      if (path.includes("/history?")) {
        historyReads += 1;
        return historyReads === 1 ? [plan] : refresh;
      }
      if (method === "PUT" && rejectPut) {
        rejectPut = false;
        throw new ApiError("Yêu cầu không thành công", 409, {
          detail: { code: "version_conflict", currentVersion: 4 },
        });
      }
      return { ...refreshedPlan, id: "plan-5", version: 5 };
    });

    renderPanel();
    await screen.findByText("Server plan v3");
    await userEvent.setup().click(screen.getByRole("button", { name: "Viết / chỉnh sửa kế hoạch" }));
    const content = screen.getByRole("textbox", { name: "Nội dung Markdown — chưa lưu" });
    await userEvent.setup().clear(content);
    await userEvent.setup().type(content, "Draft must survive");
    await userEvent.setup().click(screen.getByRole("button", { name: "Lưu phiên bản" }));

    await waitFor(() => expect(historyReads).toBe(2));
    expect(screen.getByRole("status")).toHaveTextContent(
      "Kế hoạch đã thay đổi ở phiên khác. Đang tải dữ liệu mới; bản nháp của bạn vẫn được giữ.",
    );
    expect(screen.getByRole("button", { name: "Đang lưu…" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Bỏ bản nháp" })).toBeDisabled();
    expect(screen.queryByText(/Lịch sử mới đã được tải lại/)).not.toBeInTheDocument();
    act(() => resolveRefresh([refreshedPlan]));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Kế hoạch đã thay đổi ở phiên khác. Lịch sử mới đã được tải lại; bản nháp của bạn vẫn được giữ.",
    );
    expect(content).toHaveValue("Draft must survive");
    await screen.findByText("Server plan v4");

    await userEvent.setup().click(screen.getByRole("button", { name: "Bỏ bản nháp" }));
    expect(screen.queryByText(/Kế hoạch đã thay đổi ở phiên khác/)).not.toBeInTheDocument();
    await userEvent.setup().click(screen.getByRole("button", { name: "Viết / chỉnh sửa kế hoạch" }));
    await userEvent.setup().click(screen.getByRole("button", { name: "Lưu phiên bản" }));

    await waitFor(() => {
      const puts = vi.mocked(careerRequest).mock.calls.filter((call) => call[2] === "PUT");
      expect(puts).toHaveLength(2);
      expect(puts[0]?.[3]).toEqual(expect.objectContaining({ expectedVersion: 3, content: "Draft must survive" }));
      expect(puts[1]?.[3]).toEqual(expect.objectContaining({ expectedVersion: 4, content: "Server plan v4" }));
    });
  });

  it("keeps the draft and does not claim refreshed history when recovery fails", async () => {
    let historyReads = 0;
    vi.mocked(careerRequest).mockImplementation(async (_token, path, method) => {
      if (path.includes("/goals?")) return [];
      if (path.includes("/history?")) {
        historyReads += 1;
        if (historyReads === 1) return [plan];
        throw new ApiError("Không thể tải lịch sử", 503);
      }
      if (method === "PUT") {
        throw new ApiError("Yêu cầu không thành công", 409, {
          detail: { code: "version_conflict", currentVersion: 4 },
        });
      }
      return undefined;
    });

    renderPanel();
    await screen.findByText("Server plan v3");
    await userEvent.setup().click(screen.getByRole("button", { name: "Viết / chỉnh sửa kế hoạch" }));
    const content = screen.getByRole("textbox", { name: "Nội dung Markdown — chưa lưu" });
    await userEvent.setup().clear(content);
    await userEvent.setup().type(content, "Retained after refresh failure");
    await userEvent.setup().click(screen.getByRole("button", { name: "Lưu phiên bản" }));

    expect(await screen.findByText(
      "Kế hoạch đã thay đổi ở phiên khác. Không tải được lịch sử mới; bản nháp của bạn vẫn được giữ. Hãy thử tải lại trước khi lưu.",
    )).toBeInTheDocument();
    expect(content).toHaveValue("Retained after refresh failure");
    expect(screen.queryByText(/Lịch sử mới đã được tải lại/)).not.toBeInTheDocument();
  });
});
