import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AssistantWorkspace } from "./assistant";
import { careerRequest } from "./api";
import { saveRoadmap } from "@/features/roadmap/roadmap-api";

vi.mock("@/features/auth/auth-provider", () => ({
  useAuth: () => ({
    session: {
      accessToken: "test-token",
      user: {
        id: "10000000-0000-4000-8000-000000000001",
        role: "EMPLOYEE",
        permissions: ["roadmap:self"],
      },
    },
  }),
}));

vi.mock("./api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./api")>();
  return { ...actual, careerRequest: vi.fn() };
});

vi.mock("@/features/roadmap/roadmap-api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/features/roadmap/roadmap-api")>();
  return { ...actual, saveRoadmap: vi.fn() };
});

vi.mock("@/features/roadmap/tree-editor", () => ({
  RoadmapTreeEditor: ({
    initial,
    onSave,
    onCancel,
  }: {
    initial: { title: string };
    onSave: (value: typeof initial) => void;
    onCancel: () => void;
  }) => (
    <div data-testid="roadmap-editor">
      <p>Đề xuất tạm thời: {initial.title}</p>
      <button type="button" onClick={() => onSave(initial)}>Xác nhận lưu đề xuất</button>
      <button type="button" onClick={onCancel}>Bỏ đề xuất</button>
    </div>
  ),
}));

function proposal(title: string) {
  return {
    title,
    category: "WORK" as const,
    durationWeeks: 8,
    hoursPerWeek: 4,
    milestones: [
      {
        title: "Củng cố nền tảng",
        description: "Ôn tập theo hồ sơ hiện có.",
        dueDate: null,
        tasks: [{ title: "Hoàn thành bài thực hành", metric: "2 bài" }],
      },
    ],
  };
}

function renderWorkspace() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <AssistantWorkspace initialFocus="ROADMAP" category="WORK" />
    </QueryClientProvider>,
  );
}

describe("roadmap assistant transient proposal", () => {
  let generation = 0;

  beforeEach(() => {
    vi.clearAllMocks();
    generation = 0;
    vi.mocked(saveRoadmap).mockImplementation(async () => ({} as never));
    vi.mocked(careerRequest).mockImplementation(async (_token, path, method) => {
      if (path === "/assistant/conversations" && method === undefined) return [];
      if (path === "/assistant/query") {
        generation += 1;
        const title = generation === 1 ? "Lộ trình A" : "Lộ trình B";
        return {
          conversationId: "20000000-0000-4000-8000-000000000001",
          message: {
            id: `30000000-0000-4000-8000-00000000000${generation}`,
            role: "assistant",
            content: "Milo đã tạo bản đề xuất từ nguồn hồ sơ được phép.",
            referencedUserIds: [],
            proposalData: proposal(title),
            createdAt: "2026-09-14T01:00:00Z",
          },
          referenced: [],
        };
      }
      if (path.startsWith("/assistant/conversations/")) {
        return {
          id: "20000000-0000-4000-8000-000000000001",
          contextCompanyId: null,
          title: "Tạo lộ trình backend",
          focus: "ROADMAP",
          category: "WORK",
          pinned: false,
          updatedAt: "2026-09-14T01:00:00Z",
          messages: [
            {
              id: "30000000-0000-4000-8000-000000000001",
              role: "assistant",
              content: "Milo đã tạo bản đề xuất từ nguồn hồ sơ được phép.",
              referencedUserIds: [],
              proposalData: null,
              createdAt: "2026-09-14T01:00:00Z",
            },
          ],
        };
      }
      throw new Error(`Unexpected request: ${method ?? "GET"} ${path}`);
    });
  });

  it("never saves on query and blocks replacement until explicit save or discard", async () => {
    const user = userEvent.setup();
    renderWorkspace();

    await user.type(screen.getByLabelText("Tin nhắn cho Milo"), "Tạo lộ trình A");
    await user.click(screen.getByRole("button", { name: "Gửi tin nhắn" }));

    expect(await screen.findByTestId("roadmap-editor")).toHaveTextContent("Lộ trình A");
    expect(saveRoadmap).not.toHaveBeenCalled();
    expect(screen.getByLabelText("Tin nhắn cho Milo")).toBeDisabled();
    expect(screen.getByRole("button", { name: "Gửi tin nhắn" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Cuộc trò chuyện mới" })).toBeDisabled();
    expect(screen.getByText(/lưu hoặc bỏ đề xuất đang mở/i)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Xác nhận lưu đề xuất" }));

    await waitFor(() => expect(saveRoadmap).toHaveBeenCalledTimes(1));
    expect(saveRoadmap).toHaveBeenCalledWith(
      "test-token",
      expect.objectContaining({ title: "Lộ trình A", aiSuggested: true }),
    );
  });

  it("clears the save result from A before installing and saving proposal B", async () => {
    const user = userEvent.setup();
    renderWorkspace();

    await user.type(screen.getByLabelText("Tin nhắn cho Milo"), "Tạo lộ trình A");
    await user.click(screen.getByRole("button", { name: "Gửi tin nhắn" }));
    await user.click(await screen.findByRole("button", { name: "Xác nhận lưu đề xuất" }));
    expect(await screen.findByText(/đã lưu lộ trình và mục tiêu liên kết/i)).toBeInTheDocument();

    await user.type(screen.getByLabelText("Tin nhắn cho Milo"), "Tạo lộ trình B");
    await user.click(screen.getByRole("button", { name: "Gửi tin nhắn" }));

    expect(await screen.findByTestId("roadmap-editor")).toHaveTextContent("Lộ trình B");
    expect(screen.queryByText(/đã lưu lộ trình và mục tiêu liên kết/i)).not.toBeInTheDocument();
    expect(saveRoadmap).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole("button", { name: "Xác nhận lưu đề xuất" }));
    await waitFor(() => expect(saveRoadmap).toHaveBeenCalledTimes(2));
    expect(saveRoadmap).toHaveBeenLastCalledWith(
      "test-token",
      expect.objectContaining({ title: "Lộ trình B", aiSuggested: true }),
    );
  });
});
