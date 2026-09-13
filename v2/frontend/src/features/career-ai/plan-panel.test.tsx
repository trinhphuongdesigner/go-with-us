import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Session } from "@/lib/types";
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
});
