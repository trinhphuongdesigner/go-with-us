import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { TalentAssessmentDetail } from "@/features/talent-workflows/assessments";
import type { Assessment } from "@/features/talent-workflows/shared";
import { apiRequest } from "@/lib/api";
import type { Session } from "@/lib/types";

const session: Session = {
  accessToken: "review-token",
  user: {
    id: "approver-1",
    companyId: "company-1",
    companyName: "CareerMate QA",
    email: "approver@example.invalid",
    name: "Người duyệt",
    title: "Quản trị doanh nghiệp",
    initials: "ND",
    role: "COMPANY_ADMIN",
    permissions: ["assessment:review"],
  },
};

const assessment: Assessment = {
  id: "assessment-1",
  companyId: "company-1",
  cycleId: "cycle-1",
  revieweeId: "employee-1",
  reviewerId: "employee-1",
  revieweeName: "Nhân viên",
  reviewerName: "Nhân viên",
  type: "SELF",
  status: "SUBMITTED",
  version: 1,
  templateSnapshot: {
    id: "template-1",
    familyId: "family-1",
    version: 1,
    companyId: "company-1",
    name: "Mẫu đánh giá",
    description: "",
    status: "ACTIVE",
    groups: [
      {
        id: "group-1",
        name: "Kết quả",
        description: "",
        weight: 1,
        scoreDimension: "CONTRIBUTION",
        questions: [
          { id: "question-1", text: "Hoàn thành công việc", guidance: "", weight: 1, maxScore: 10 },
        ],
      },
    ],
  },
  answers: [{ questionId: "question-1", score: 8, comment: "evidence" }],
  mood: "Tốt",
  highlights: "",
  comment: "",
  reviewComment: "",
  totalScore: 8,
  contributionScore: 8,
  attitudeScore: null,
};

vi.mock("@/features/auth/auth-provider", () => ({
  useAuth: () => ({ session, status: "authenticated" }),
}));

vi.mock("@/lib/api", () => ({
  apiRequest: vi.fn(),
  listAvailableCompaniesLive: vi.fn(),
}));

function renderDetail() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <TalentAssessmentDetail id={assessment.id} />
    </QueryClientProvider>,
  );
}

describe("assessment review actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(apiRequest).mockImplementation(async (path, options) => {
      if (options?.method === "POST") return { ...assessment, status: "DRAFT", version: 2 };
      return assessment;
    });
  });

  it("sends a revision request to the revision endpoint and never to terminal reject", async () => {
    const user = userEvent.setup();
    renderDetail();

    await user.type(
      await screen.findByLabelText("Nhận xét / lý do cần chỉnh sửa"),
      "Bổ sung minh chứng",
    );
    await user.click(screen.getByRole("button", { name: "Yêu cầu chỉnh sửa" }));

    await waitFor(() => {
      expect(apiRequest).toHaveBeenCalledWith(
        `/assessments/${assessment.id}/request-revision`,
        {
          method: "POST",
          body: JSON.stringify({ expectedVersion: 1, comment: "Bổ sung minh chứng" }),
        },
        session.accessToken,
      );
    });
    expect(apiRequest).not.toHaveBeenCalledWith(
      `/assessments/${assessment.id}/reject`,
      expect.anything(),
      session.accessToken,
    );
  });
});
