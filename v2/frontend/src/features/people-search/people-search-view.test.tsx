import { render as renderWithTestingLibrary, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import userEvent from "@testing-library/user-event";
import type { ReactElement } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { askPeople, searchPeople, type PeopleSearchResponse, type RagSearchResponse } from "@/features/people-search/people-search-api";
import { PeopleSearchView } from "@/features/people-search/people-search-view";
import { canonicalSearchResponse } from "./__fixtures__/canonical-search";
import { searchInterpretation } from "./__fixtures__/search-interpretation";

vi.mock("@/features/auth/auth-provider", () => ({
  useAuth: () => ({ session: { accessToken: "actual-session-token", user: { permissions: ["people:read"] } } }),
}));
vi.mock("@/features/people-search/people-search-api", async (importOriginal) => ({
  ...await importOriginal<typeof import("@/features/people-search/people-search-api")>(),
  askPeople: vi.fn(),
  searchPeople: vi.fn(),
}));

const plan: PeopleSearchResponse["plan"] = {
  raw_query: "React",
  required_skills: [{ phrase: "React", required: true }],
  preferred_skills: [],
  min_experience_years: 2,
  availability: null,
  needs_clarification: false,
  clarification_reason: null,
};
const candidate: PeopleSearchResponse["candidates"][number] = {
  user_id: "3a65de39-49f1-40c7-8f1d-df80a565d46e",
  name: "Nguyễn Văn A",
  title: null,
  company_id: "11395991-a669-475f-9af5-912afbbe554b",
  score: 87,
  score_version: "people-search-v1",
  factors: [{ code: "EXPERIENCE", label: "Kinh nghiệm", weight: 0.5, contribution: 87 }],
  evidence: [{ type: "employment", user_id: null, employment_id: "e1", job_title: null, title: "Engineer", status: "ACTIVE", start_date: "2022-01-01", end_date: "" }],
};

function render(ui: ReactElement) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return renderWithTestingLibrary(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

async function submit(query = "React trên 2 năm") {
  const user = userEvent.setup();
  await user.type(screen.getByLabelText("Mô tả yêu cầu tìm kiếm nhân sự"), query);
  await user.click(screen.getByRole("button", { name: /Tìm kiếm/ }));
}

describe("PeopleSearchView", () => {
  beforeEach(() => {
    vi.mocked(askPeople).mockReset();
    vi.mocked(searchPeople).mockReset();
  });

  it("offers separate criteria and AI question tabs with keyboard navigation", async () => {
    render(<PeopleSearchView />);
    const criteriaTab = screen.getByRole("tab", { name: "Tìm theo yêu cầu" });
    const assistantTab = screen.getByRole("tab", { name: "Hỏi AI" });
    expect(criteriaTab).toHaveAttribute("aria-selected", "true");
    expect(screen.getByLabelText("Kỹ năng bắt buộc")).toBeVisible();

    criteriaTab.focus();
    await userEvent.setup().keyboard("{ArrowRight}");
    expect(assistantTab).toHaveFocus();
    expect(assistantTab).toHaveAttribute("aria-selected", "true");
    expect(screen.getByLabelText("Câu hỏi cho AI")).toBeVisible();
    expect(screen.queryByLabelText("Kỹ năng bắt buộc")).not.toBeInTheDocument();

    await userEvent.setup().keyboard("{ArrowLeft}");
    expect(criteriaTab).toHaveFocus();
    expect(criteriaTab).toHaveAttribute("aria-selected", "true");
  });

  it("uses the evidence-backed people search API for an AI question", async () => {
    const response: RagSearchResponse = {
      status: "ok",
      answer: "Nguyễn An có bằng chứng kỹ năng React phù hợp.",
      candidates: [{
        user_id: "3a65de39-49f1-40c7-8f1d-df80a565d46e",
        name: "Nguyễn An",
        title: "Frontend Engineer",
        company_id: "11395991-a669-475f-9af5-912afbbe554b",
        matched_terms: ["react"],
        reason: "Có kỹ năng React trong hồ sơ.",
        evidence: [{ source_type: "skill", source_id: "3a65de39-49f1-40c7-8f1d-df80a565d47e", label: "Kỹ năng: React", excerpt: "React, mức độ 4/5", verified: false }],
      }],
      retrieval_mode: "STRUCTURED_PROFILE_RAG",
      answer_source: "ai",
      warnings: [],
    };
    vi.mocked(askPeople).mockResolvedValue(response);
    render(<PeopleSearchView />);
    await userEvent.setup().click(screen.getByRole("tab", { name: "Hỏi AI" }));
    const question = "Ai phù hợp dẫn dắt dự án React trong quý tới?";
    await userEvent.setup().type(screen.getByLabelText("Câu hỏi cho AI"), question);
    await userEvent.setup().click(screen.getByRole("button", { name: "Hỏi AI" }));

    await waitFor(() => expect(askPeople).toHaveBeenCalledWith(expect.objectContaining({ accessToken: "actual-session-token", query: question, signal: expect.any(AbortSignal) })));
    expect(searchPeople).not.toHaveBeenCalled();
    expect(await screen.findByText("Nguyễn An")).toBeVisible();
    expect(screen.getByText("Nguyễn An có bằng chứng kỹ năng React phù hợp.")).toBeVisible();
    expect(screen.getByText("React, mức độ 4/5")).toBeVisible();
    expect(screen.getByText("Tự khai báo")).toBeVisible();
    expect(screen.getByText(question, { selector: "div" })).toBeVisible();
  });

  it("shows interpreted strict skill years separately from overall experience", async () => {
    vi.mocked(searchPeople).mockResolvedValue({ ...canonicalSearchResponse, plan: { ...canonicalSearchResponse.plan, interpretation: searchInterpretation } });
    render(<PeopleSearchView />);
    await submit();
    const panel = await screen.findByRole("region", { name: "Tiêu chí AI đã phân tích" });
    expect(within(panel).getByText("React · trên 2 năm · cấp độ từ 3/5")).toBeVisible();
    expect(within(panel).getByText("Tổng kinh nghiệm: từ 5 năm")).toBeVisible();
    expect(within(panel).getByText("Lĩnh vực bắt buộc: bất động sản")).toBeVisible();
    expect(within(panel).getByText("Sẵn sàng ngay hoặc sắp sẵn sàng")).toBeVisible();
    expect(panel).not.toHaveTextContent("00000000-");
  });

  it("marks unknown catalog terms as unresolved in clarification state", async () => {
    const interpretation = { ...searchInterpretation, skills: [{ ...searchInterpretation.skills[0], name: "UnknownStack", canonical_skill_id: null }], required_domains: [{ name: "UnknownDomain", canonical_domain: null }], unsupported_constraints: ["loại trừ dự án cũ"], missing_fields: ["TIMEFRAME" as const] };
    vi.mocked(searchPeople).mockResolvedValue({ ...canonicalSearchResponse, status: "needs_clarification", candidates: [], plan: { ...canonicalSearchResponse.plan, needs_clarification: true, interpretation } });
    render(<PeopleSearchView />);
    await submit();
    const panel = await screen.findByRole("region", { name: "Tiêu chí AI đã phân tích" });
    expect(within(panel).getAllByText("Chưa xác định trong danh mục")).toHaveLength(2);
    expect(within(panel).getByText("Chưa hỗ trợ: loại trừ dự án cũ")).toBeVisible();
    expect(within(panel).getByText("Cần bổ sung: khoảng thời gian")).toBeVisible();
    expect(within(panel).getByText(/Chưa áp dụng tìm kiếm/)).toBeVisible();
  });

  it("switches result layout with the keyboard without refetching or losing open citations", async () => {
    vi.mocked(searchPeople).mockResolvedValue(canonicalSearchResponse);
    render(<PeopleSearchView />);
    await submit();
    const cards = await screen.findByRole("button", { name: "Dạng thẻ" });
    const compact = screen.getByRole("button", { name: "Danh sách gọn" });
    expect(cards).toHaveAttribute("aria-pressed", "true");
    const source = screen.getByText("Trích dẫn nguồn (1)");
    const user = userEvent.setup();
    await user.click(source);
    compact.focus();
    await user.keyboard("{Enter}");
    expect(compact).toHaveFocus();
    expect(compact).toHaveAttribute("aria-pressed", "true");
    expect(cards).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByText("Kinh nghiệm React: 3 năm.")).toBeVisible();
    expect(screen.getByRole("list", { name: "Kết quả tìm kiếm" }).children).toHaveLength(1);
    expect(searchPeople).toHaveBeenCalledTimes(1);
    cards.focus();
    await user.keyboard(" ");
    expect(cards).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByText("Kinh nghiệm React: 3 năm.")).toBeVisible();
  });

  it("preserves server ordering, legacy evidence and layout across a new search", async () => {
    const response: PeopleSearchResponse = { status: "ok", plan, candidates: [candidate, { ...candidate, user_id: "3a65de39-49f1-40c7-8f1d-df80a565d47f", name: "Trần Văn B", score: 70, factors: [{ ...candidate.factors[0], contribution: 70 }] }], unsupported_reasons: [], explanation: null, explanation_source: null };
    vi.mocked(searchPeople).mockResolvedValue(response);
    render(<PeopleSearchView />);
    await submit();
    const compact = await screen.findByRole("button", { name: "Danh sách gọn" });
    const user = userEvent.setup();
    await user.click(compact);
    expect(within(screen.getByRole("list", { name: "Kết quả tìm kiếm" })).getAllByRole("heading", { level: 3 }).map((heading) => heading.textContent)).toEqual(["Nguyễn Văn A", "Trần Văn B"]);
    const source = screen.getAllByText("Nguồn bằng chứng (1)")[0];
    await user.click(source);
    expect(within(source.closest("details")!).getByText(/Dữ liệu hồ sơ hiện tại, có thể thay đổi/)).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Tìm kiếm" }));
    expect(await screen.findByRole("button", { name: "Danh sách gọn" })).toHaveAttribute("aria-pressed", "true");
    expect(searchPeople).toHaveBeenCalledTimes(2);
  });

  it("shows canonical source excerpts separately from mutable profile rows", async () => {
    vi.mocked(searchPeople).mockResolvedValue(canonicalSearchResponse);
    render(<PeopleSearchView />);
    await submit();
    const summary = await screen.findByText("Trích dẫn nguồn (1)");
    await userEvent.setup().click(summary);
    expect(screen.getByText("Kinh nghiệm React: 3 năm.")).toBeVisible();
    expect(screen.getByText("Kỹ năng bắt buộc")).toBeVisible();
    expect(screen.getByText(/12\/09\/2026/)).toBeVisible();
    expect(screen.queryByText(/Dữ liệu hồ sơ hiện tại, có thể thay đổi/)).not.toBeInTheDocument();
    expect(summary.closest("details")).not.toHaveTextContent("00000000-");
  });

  it("does not suggest relaxing criteria when evidence is unavailable", async () => {
    vi.mocked(searchPeople).mockResolvedValue({ ...canonicalSearchResponse, status: "insufficient_evidence", candidates: [] });
    render(<PeopleSearchView />);
    await submit();
    expect(await screen.findByText("Chưa đủ bằng chứng để tìm kiếm")).toBeVisible();
    expect(screen.queryByText("Không tìm thấy nhân sự phù hợp")).not.toBeInTheDocument();
    expect(screen.queryByText(/nới rộng tiêu chí/)).not.toBeInTheDocument();
  });

  it("shows structured filters and passes session token", async () => {
    vi.mocked(searchPeople).mockResolvedValue({ status: "empty", plan, candidates: [], unsupported_reasons: [], explanation: null, explanation_source: null });
    render(<PeopleSearchView />);
    await userEvent.setup().type(screen.getByLabelText("Kỹ năng bắt buộc"), "React");
    await submit("Tìm kỹ sư");
    await waitFor(() => expect(searchPeople).toHaveBeenCalledWith(expect.objectContaining({ accessToken: "actual-session-token", query: expect.stringContaining("kỹ năng bắt buộc: React"), signal: expect.any(AbortSignal) })));
  });

  it("renders contract evidence and provider fallback even without explanation", async () => {
    vi.mocked(searchPeople).mockResolvedValue({ status: "ok", plan, candidates: [candidate], unsupported_reasons: [], explanation: null, explanation_source: "deterministic_fallback" });
    render(<PeopleSearchView />);
    await submit();
    await waitFor(() => expect(screen.getByText("Nguyễn Văn A")).toBeInTheDocument());
    expect(screen.getByText(/Giải thích AI chưa khả dụng/)).toBeInTheDocument();
    expect(screen.getByText("Nguồn bằng chứng (1)")).toBeInTheDocument();
  });

  it("shows clarification and unsupported mandatory warning", async () => {
    vi.mocked(searchPeople).mockResolvedValue({
      status: "needs_clarification",
      plan: { ...plan, needs_clarification: true, clarification_reason: "Không thể xác minh domain bắt buộc." },
      candidates: [],
      unsupported_reasons: ["Domain chưa có dữ liệu chuẩn hoá."],
      explanation: null,
      explanation_source: null,
    });
    render(<PeopleSearchView />);
    await submit();
    await waitFor(() => expect(screen.getByText("Không thể xác minh domain bắt buộc.")).toBeInTheDocument());
    expect(screen.getByText("Không xem kết quả này là khớp đủ tiêu chí bắt buộc.")).toBeInTheDocument();
  });

  it("renders readable source fields without exposing internal row identifiers", async () => {
    vi.mocked(searchPeople).mockResolvedValue({ status: "ok", plan, candidates: [candidate], unsupported_reasons: [], explanation: null, explanation_source: "deterministic_fallback" });
    render(<PeopleSearchView />);
    await submit();
    const summary = await screen.findByText("Nguồn bằng chứng (1)");
    await userEvent.setup().click(summary);
    const sources = within(summary.closest("details")!);
    expect(sources.getByText("Quá trình công tác")).toBeVisible();
    expect(sources.getByText("Chức danh")).toBeVisible();
    expect(sources.getByText("Engineer")).toBeVisible();
    expect(sources.getByText("Đang làm việc")).toBeVisible();
    expect(sources.getByText("01/01/2022")).toBeVisible();
    expect(sources.getByText(/Dữ liệu hồ sơ hiện tại/)).toBeVisible();
    for (const internal of ["employment_id:", "user_id:", "e1", "ACTIVE", "start_date:"]) {
      expect(summary.closest("details")).not.toHaveTextContent(internal);
    }
  });

  it.each(["not-a-date", "2026-02-30"])("does not infer employment facts from missing or invalid data (%s)", async (invalidDate) => {
    const evidence = { ...candidate.evidence[0], status: "UNRECOGNIZED", start_date: invalidDate, end_date: null };
    vi.mocked(searchPeople).mockResolvedValue({ status: "ok", plan, candidates: [{ ...candidate, evidence: [evidence] }], unsupported_reasons: [], explanation: null, explanation_source: null });
    render(<PeopleSearchView />);
    await submit();
    const summary = await screen.findByText("Nguồn bằng chứng (1)");
    await userEvent.setup().click(summary);
    const sources = within(summary.closest("details")!);
    expect(sources.getByText("Chưa xác định")).toBeVisible();
    expect(sources.getAllByText("Chưa ghi nhận")).toHaveLength(2);
    expect(sources.queryByText("Đang làm việc")).not.toBeInTheDocument();
    expect(sources.queryByText(invalidDate)).not.toBeInTheDocument();
  });

  it("labels user profile sources and handles an absent title", async () => {
    const evidence = { ...candidate.evidence[0], type: "user" as const, user_id: candidate.user_id, employment_id: null, job_title: null };
    vi.mocked(searchPeople).mockResolvedValue({ status: "ok", plan, candidates: [{ ...candidate, evidence: [evidence] }], unsupported_reasons: [], explanation: null, explanation_source: null });
    render(<PeopleSearchView />);
    await submit();
    const summary = await screen.findByText("Nguồn bằng chứng (1)");
    await userEvent.setup().click(summary);
    const sources = within(summary.closest("details")!);
    expect(sources.getByText("Hồ sơ nhân sự")).toBeVisible();
    expect(sources.getByText("Chưa ghi nhận")).toBeVisible();
    expect(sources.queryByText(candidate.user_id)).not.toBeInTheDocument();
    expect(sources.queryByText("Engineer")).not.toBeInTheDocument();
  });

  it("retries captured request, not edited form value", async () => {
    vi.mocked(searchPeople).mockRejectedValueOnce(new Error("Mất kết nối")).mockResolvedValueOnce({ status: "empty", plan, candidates: [], unsupported_reasons: [], explanation: null, explanation_source: null });
    render(<PeopleSearchView />);
    await submit("React");
    await screen.findByText("Mất kết nối");
    await userEvent.setup().type(screen.getByLabelText("Mô tả yêu cầu tìm kiếm nhân sự"), " Python");
    await userEvent.setup().click(screen.getByRole("button", { name: "Thử lại" }));
    await waitFor(() => expect(searchPeople).toHaveBeenLastCalledWith(expect.objectContaining({ query: "React" })));
  });

  it("shows provider failure and retries captured request", async () => {
    vi.mocked(searchPeople)
      .mockResolvedValueOnce({ status: "provider_failure", plan, candidates: [], unsupported_reasons: [], explanation: null, explanation_source: null })
      .mockResolvedValueOnce({ status: "empty", plan, candidates: [], unsupported_reasons: [], explanation: null, explanation_source: null });
    render(<PeopleSearchView />);
    await submit("React");
    await screen.findByText("Không thể tạo kết quả bằng AI");
    await userEvent.setup().click(screen.getByRole("button", { name: "Thử lại" }));
    await waitFor(() => expect(searchPeople).toHaveBeenLastCalledWith(expect.objectContaining({ query: "React" })));
  });
});
