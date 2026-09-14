import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { TalentTemplates } from "@/features/talent-workflows/templates";
import type { Template } from "@/features/talent-workflows/shared";
import { apiRequest } from "@/lib/api";
import type { Session } from "@/lib/types";

const session: Session = {
  accessToken: "template-token",
  user: {
    id: "admin-1",
    companyId: "company-1",
    companyName: "CareerMate QA",
    email: "admin@example.invalid",
    name: "Quản trị",
    title: "HR",
    initials: "QT",
    role: "COMPANY_ADMIN",
    permissions: ["assessment:review"],
  },
};

const template: Template = {
  id: "template-1",
  familyId: "family-1",
  version: 7,
  rowVersion: 42,
  companyId: "company-1",
  name: "Mẫu năng lực",
  description: "Mẫu kiểm tra",
  status: "DRAFT",
  groups: [
    {
      id: "group-1",
      name: "Kết quả",
      description: "",
      weight: 1,
      scoreDimension: "CONTRIBUTION",
      passportDimension: null,
      questions: [
        { id: "question-1", text: "Chất lượng", guidance: "", weight: 1, maxScore: 10 },
      ],
    },
  ],
};

vi.mock("next/navigation", () => ({
  usePathname: () => "/cong-ty/tieu-chi",
  useRouter: () => ({ replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock("@/features/auth/auth-provider", () => ({
  useAuth: () => ({ session, status: "authenticated" }),
}));

vi.mock("@/lib/api", () => ({
  apiRequest: vi.fn(),
  listAvailableCompaniesLive: vi.fn(),
}));

function renderTemplates() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <TalentTemplates />
    </QueryClientProvider>,
  );
}

describe("template content revision and row version", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(apiRequest).mockImplementation(async (path, options) => {
      if (path === "/company-memberships/mine") {
        return [{ id: "company-1", name: "CareerMate QA" }];
      }
      if (path.startsWith("/assessments/templates?")) return [template];
      if (path.startsWith("/assessments/cycles?")) return [];
      if (options?.method === "PUT") {
        return { ...template, id: "template-2", version: 8, rowVersion: 1 };
      }
      return { ...template, status: "ACTIVE", rowVersion: 43 };
    });
  });

  it.each([
    ["Phát hành", "publish"],
    ["Lưu trữ", "archive"],
  ])("displays the content revision but sends rowVersion when using %s", async (label, action) => {
    const user = userEvent.setup();
    renderTemplates();

    expect(await screen.findByText("Bản nháp · v7")).toBeVisible();
    await user.click(screen.getByRole("button", { name: label }));

    await waitFor(() => {
      expect(apiRequest).toHaveBeenCalledWith(
        `/assessments/templates/${template.id}/${action}`,
        { method: "POST", body: JSON.stringify({ expectedRowVersion: 42 }) },
        session.accessToken,
      );
    });
  });

  it("uses rowVersion when saving a new content revision", async () => {
    const user = userEvent.setup();
    renderTemplates();

    await user.click(await screen.findByRole("button", { name: "Chỉnh sửa" }));
    await user.click(screen.getByRole("button", { name: "Lưu bản nháp" }));

    await waitFor(() => {
      const put = vi.mocked(apiRequest).mock.calls.find(([, options]) => options?.method === "PUT");
      expect(put).toBeDefined();
      expect(JSON.parse(String(put?.[1]?.body))).toMatchObject({ expectedRowVersion: 42 });
    });
  });
});
