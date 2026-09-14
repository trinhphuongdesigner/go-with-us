import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { PersistedRoadmapView } from "./persisted-roadmap-view";
import { careerRequest } from "@/features/career-ai/api";
import { getRoadmapSettings, listRoadmaps, type Roadmap } from "./roadmap-api";
import { ApiError } from "@/lib/api";
import type { Session } from "@/lib/types";

vi.mock("@/features/career-ai/plan-panel", () => ({ CareerPlanPanel: () => null }));
vi.mock("@/features/career-ai/assistant", () => ({ AssistantWorkspace: () => null }));
vi.mock("@/features/career-ai/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/features/career-ai/api")>()),
  careerRequest: vi.fn(),
}));
vi.mock("./roadmap-api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./roadmap-api")>()),
  getRoadmapSettings: vi.fn(),
  listRoadmaps: vi.fn(),
}));
vi.mock("./tree-editor", async () => {
  const { useState } = await import("react");
  return {
  RoadmapTreeEditor: ({ initial, onSave, onCancel }: {
    initial: {
      title: string;
      category: "WORK" | "PERSONAL";
      durationWeeks: number | null;
      hoursPerWeek: number | null;
      milestones: Array<{
        title: string;
        description: string | null;
        dueDate: string | null;
        tasks: Array<{ title: string; metric: string | null; done: boolean }>;
      }>;
    };
    onSave: (draft: typeof initial) => void;
    onCancel: () => void;
  }) => {
    const [title, setTitle] = useState(initial.title);
    return (
      <form
        aria-label="mock roadmap editor"
        onSubmit={(event) => {
          event.preventDefault();
          onSave({ ...initial, title });
        }}
      >
        <label>
          Tên lộ trình
          <input value={title} onChange={(event) => setTitle(event.target.value)} />
        </label>
        <button type="submit">Lưu chỉnh sửa lộ trình</button>
        <button type="button" onClick={onCancel}>Hủy chỉnh sửa giả lập</button>
      </form>
    );
  },
  };
});

const session: Session = {
  accessToken: "roadmap-token",
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

function roadmap(id: string, version: number): Roadmap {
  return {
    id,
    version,
    title: `Roadmap ${id.toUpperCase()}`,
    category: "WORK",
    durationWeeks: 12,
    hoursPerWeek: 3,
    progress: 0,
    completedTasks: 0,
    totalTasks: 1,
    createdAt: "2026-09-13T00:00:00Z",
    updatedAt: "2026-09-13T00:00:00Z",
    milestones: [
      {
        id: `${id}-milestone`,
        title: "Milestone",
        description: null,
        dueDate: null,
        order: 0,
        status: "NOT_STARTED",
        completedTasks: 0,
        totalTasks: 1,
        tasks: [
          {
            id: `${id}-task`,
            title: "Task",
            metric: null,
            order: 0,
            done: false,
          },
        ],
      },
    ],
  };
}

function renderView() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <PersistedRoadmapView session={session} />
    </QueryClientProvider>,
  );
  return client;
}

describe("persisted roadmap concurrent actions", () => {
  beforeEach(() => {
    vi.mocked(listRoadmaps).mockReset().mockResolvedValue([roadmap("a", 3), roadmap("b", 7)]);
    vi.mocked(getRoadmapSettings).mockReset().mockResolvedValue({
      settings: {
        version: 1,
        character: "none",
        viewMode: "stair",
        costumeColor: "#315E81",
        reduceMotion: false,
        fontSize: "md",
      },
    });
    vi.mocked(careerRequest).mockReset().mockResolvedValue({});
  });

  it("deletes the roadmap snapshot selected when confirmation opened", async () => {
    let resolveDelete!: (value: unknown) => void;
    const pendingDelete = new Promise<unknown>((resolve) => {
      resolveDelete = resolve;
    });
    vi.mocked(careerRequest).mockReturnValueOnce(pendingDelete);
    renderView();
    const selector = await screen.findByLabelText(/Lộ trình đã lưu/);
    await userEvent.setup().click(screen.getByRole("button", { name: "Xóa lộ trình" }));
    await userEvent.setup().selectOptions(selector, "b");
    expect(screen.getByText(/Xóa lộ trình “Roadmap A”/)).toBeInTheDocument();
    const confirmDelete = screen.getByRole("button", { name: "Xác nhận xóa" });
    await userEvent.setup().click(confirmDelete);

    await waitFor(() =>
      expect(careerRequest).toHaveBeenCalledWith(
        "roadmap-token",
        "/development-plans/me/roadmaps/a?expected_version=3",
        "DELETE",
      ),
    );
    expect(confirmDelete).toBeDisabled();

    await act(async () => {
      resolveDelete({});
      await pendingDelete;
    });
    await waitFor(() =>
      expect(screen.queryByRole("button", { name: "Xác nhận xóa" })).not.toBeInTheDocument(),
    );
    expect(selector).toHaveValue("b");
    expect(screen.getByRole("heading", { name: "Roadmap B" })).toBeInTheDocument();
  });

  it("saves an editor draft against the version captured when editing opened", async () => {
    const client = renderView();
    await screen.findByLabelText(/Lộ trình đã lưu/);
    await userEvent.setup().click(
      screen.getByRole("button", { name: "Chỉnh sửa chặng & công việc" }),
    );
    const title = screen.getByLabelText("Tên lộ trình");
    await userEvent.setup().clear(title);
    await userEvent.setup().type(title, "A draft");

    act(() => {
      client.setQueryData<Roadmap[]>(
        ["roadmaps", "company-1:employee-1", "WORK"],
        [roadmap("a", 4), roadmap("b", 7)],
      );
    });
    await userEvent.setup().click(
      screen.getByRole("button", { name: "Lưu chỉnh sửa lộ trình" }),
    );

    await waitFor(() => {
      const request = vi.mocked(careerRequest).mock.calls[0];
      expect(request?.[1]).toBe("/development-plans/me/roadmaps/a");
      expect(request?.[3]).toEqual(expect.objectContaining({ expectedVersion: 3, title: "A draft" }));
    });
  });

  it("keeps the captured editor and draft after a version conflict", async () => {
    vi.mocked(careerRequest).mockRejectedValueOnce(
      new ApiError("Phiên bản lộ trình không khớp", 409, {
        code: "version_conflict",
        currentVersion: 4,
      }),
    );
    const client = renderView();
    await screen.findByLabelText(/Lộ trình đã lưu/);
    await userEvent.setup().click(
      screen.getByRole("button", { name: "Chỉnh sửa chặng & công việc" }),
    );
    const title = screen.getByLabelText("Tên lộ trình");
    await userEvent.setup().clear(title);
    await userEvent.setup().type(title, "Bản nháp cần giữ");

    act(() => {
      client.setQueryData<Roadmap[]>(
        ["roadmaps", "company-1:employee-1", "WORK"],
        [roadmap("a", 4), roadmap("b", 7)],
      );
    });
    await userEvent.setup().click(
      screen.getByRole("button", { name: "Lưu chỉnh sửa lộ trình" }),
    );

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Dữ liệu đã đổi ở nơi khác",
    );
    expect(screen.getByLabelText("Tên lộ trình")).toHaveValue("Bản nháp cần giữ");
    expect(screen.getByLabelText(/Lộ trình đã lưu/)).toBeDisabled();
    expect(screen.getByRole("checkbox", { name: /Task/ })).toBeDisabled();
    expect(careerRequest).toHaveBeenCalledWith(
      "roadmap-token",
      "/development-plans/me/roadmaps/a",
      "PUT",
      expect.objectContaining({ expectedVersion: 3, title: "Bản nháp cần giữ" }),
    );

    await userEvent.setup().click(
      screen.getByRole("button", { name: "Hủy chỉnh sửa giả lập" }),
    );
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    await userEvent.setup().click(
      screen.getByRole("button", { name: "Chỉnh sửa chặng & công việc" }),
    );
    await userEvent.setup().click(
      screen.getByRole("button", { name: "Lưu chỉnh sửa lộ trình" }),
    );
    await waitFor(() =>
      expect(careerRequest).toHaveBeenLastCalledWith(
        "roadmap-token",
        "/development-plans/me/roadmaps/a",
        "PUT",
        expect.objectContaining({ expectedVersion: 4, title: "Roadmap A" }),
      ),
    );
  });
});
