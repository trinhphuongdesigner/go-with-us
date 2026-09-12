"use client";

import { AlertTriangle, LayoutGrid, List, MessageSquareText, Search, Send, SlidersHorizontal, Sparkles } from "lucide-react";
import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { listAvailableCompanies } from "@/lib/api";

import { EmptyState, ErrorState, LoadingState } from "@/components/ui/app-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/features/auth/auth-provider";
import {
  askPeople,
  compileQuery,
  searchPeople,
  type LegacyPeopleSearchCandidate,
  type PeopleSearchFilters,
  type PeopleSearchResponse,
  type RagSearchCandidate,
  type RagSearchResponse,
} from "@/features/people-search/people-search-api";
import type { CanonicalSearchCandidate } from "./canonical-search-schema";
import { SearchInterpretationPanel } from "./search-interpretation-panel";

type ResultLayout = "cards" | "compact";
type SearchMode = "criteria" | "assistant";
type SearchState = {
  status: "idle" | "loading" | "success" | "error";
  mode?: SearchMode;
  query?: string;
  data?: PeopleSearchResponse | RagSearchResponse;
  error?: string;
};

const initialFilters: PeopleSearchFilters = {
  query: "",
  requiredSkills: "",
  preferredSkills: "",
  minExperienceYears: "",
  domains: "",
  availability: "",
};

const assistantPrompts = [
  "Ai phù hợp để dẫn dắt dự án React trong 3 tháng tới?",
  "Tìm nhân sự backend có kinh nghiệm Python và làm việc với dữ liệu.",
  "Ai có thể tham gia dự án mới và đang sẵn sàng?",
];

function UnsupportedBanner({ reasons }: { reasons: string[] }) {
  if (reasons.length === 0) return null;
  return (
    <div className="mt-4 flex items-start gap-3 rounded-xl border border-[#F6D5D2] bg-danger-soft p-4 text-sm text-[#7A271A]" role="alert">
      <AlertTriangle size={18} className="mt-0.5 shrink-0" aria-hidden="true" />
      <div>
        <p className="font-semibold">Tiêu chí chưa được hỗ trợ đầy đủ</p>
        <ul className="mt-1 list-disc space-y-0.5 pl-4">
          {reasons.map((reason) => <li key={reason}>{reason}</li>)}
        </ul>
        <p className="mt-2">Không xem kết quả này là khớp đủ tiêu chí bắt buộc.</p>
      </div>
    </div>
  );
}

function sourceDate(value: string | null): string {
  const day = value?.match(/^\d{4}-\d{2}-\d{2}(?=T|$)/)?.[0];
  if (!day) return "Chưa ghi nhận";
  const date = new Date(`${day}T00:00:00Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== day) return "Chưa ghi nhận";
  const [year, month, dateOfMonth] = day.split("-");
  return `${dateOfMonth}/${month}/${year}`;
}

function SourceFields({ evidence }: { evidence: LegacyPeopleSearchCandidate["evidence"][number] }) {
  const status = evidence.status === "ACTIVE" ? "Đang làm việc" : evidence.status === "ENDED" ? "Đã kết thúc" : "Chưa xác định";
  const fields = evidence.type === "user"
    ? [["Chức danh", evidence.job_title?.trim() || "Chưa ghi nhận"]]
    : [
        ["Chức danh", evidence.title?.trim() || "Chưa ghi nhận"],
        ["Trạng thái", status],
        ["Ngày bắt đầu", sourceDate(evidence.start_date)],
        ["Ngày kết thúc", sourceDate(evidence.end_date)],
      ];

  return (
    <>
      <p className="font-semibold text-ink">{evidence.type === "user" ? "Hồ sơ nhân sự" : "Quá trình công tác"}</p>
      <dl className="mt-2 grid min-w-0 gap-2 sm:grid-cols-2">
        {fields.map(([label, value]) => (
          <div key={label} className="min-w-0">
            <dt className="text-muted">{label}</dt>
            <dd className="wrap-anywhere text-ink">{value}</dd>
          </div>
        ))}
      </dl>
    </>
  );
}

function CandidateCard({ candidate, layout }: { candidate: LegacyPeopleSearchCandidate; layout: ResultLayout }) {
  return (
    <Card className={layout === "compact" ? "min-w-0 rounded-none border-0 p-4" : "min-w-0 h-full p-4 sm:p-5"}>
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h3 className="wrap-anywhere text-sm font-bold text-ink">{candidate.name}</h3>
          <p className="mt-0.5 wrap-anywhere text-xs text-muted">{candidate.title ?? "Chưa có chức danh"}</p>
        </div>
        <Badge tone="success">{Math.round(candidate.score)} điểm</Badge>
      </div>
      {candidate.factors.length > 0 ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {candidate.factors.map((factor) => (
            <Badge key={factor.code} tone="neutral" title={`Trọng số ${factor.weight} · đóng góp ${factor.contribution}`}>
              {factor.label}: {factor.contribution}
            </Badge>
          ))}
        </div>
      ) : null}
      {candidate.evidence.length > 0 ? (
        <details className="mt-3 text-sm leading-6 text-muted">
          <summary className="cursor-pointer rounded-lg py-2 font-semibold text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">Nguồn bằng chứng ({candidate.evidence.length})</summary>
          <p className="mt-2">Dữ liệu hồ sơ hiện tại, có thể thay đổi; chưa phải nguồn trích dẫn bất biến đã xác minh cho AI.</p>
          <ul className="mt-2 space-y-2">
            {candidate.evidence.map((evidence, index) => (
              <li key={`${evidence.type}-${evidence.employment_id ?? evidence.user_id ?? index}`} className="min-w-0 rounded-xl border border-border bg-background p-3">
                <SourceFields evidence={evidence} />
              </li>
            ))}
          </ul>
        </details>
      ) : <p className="mt-3 text-xs text-muted">Chưa có bằng chứng có thể kiểm tra.</p>}
    </Card>
  );
}

const factorLabels: Record<CanonicalSearchCandidate["score_factors"][number]["code"], string> = {
  REQUIRED_SKILL: "Kỹ năng bắt buộc", PREFERRED_SKILL: "Kỹ năng ưu tiên",
  EXPERIENCE: "Kinh nghiệm", DOMAIN: "Lĩnh vực", AVAILABILITY: "Trạng thái sẵn sàng", DATA_FRESHNESS: "Độ mới của dữ liệu",
};

function CanonicalCandidateCard({ candidate, layout }: { candidate: CanonicalSearchCandidate; layout: ResultLayout }) {
  return (
    <Card className={layout === "compact" ? "min-w-0 rounded-none border-0 p-4" : "min-w-0 h-full p-4 sm:p-5"}>
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h3 className="wrap-anywhere text-sm font-bold text-ink">{candidate.name}</h3>
          <p className="mt-0.5 wrap-anywhere text-xs text-muted">{candidate.title ?? "Chưa có chức danh"}</p>
        </div>
        <Badge tone="success">{candidate.score} điểm</Badge>
      </div>
      <dl className={layout === "compact" ? "mt-3 flex flex-wrap gap-x-6 gap-y-2" : "mt-4 grid gap-3 sm:grid-cols-2"}>
        {candidate.score_factors.map((factor) => (
          <div key={factor.code} className={layout === "compact" ? "min-w-0" : "min-w-0 rounded-xl bg-background p-3"}>
            <dt className="text-sm text-muted">{factorLabels[factor.code]}</dt>
            <dd className="mt-1 text-sm font-semibold text-ink">{factor.points} / {factor.maximum_points} điểm</dd>
          </div>
        ))}
      </dl>
      <p className="mt-3 text-xs text-muted">Nguồn cũ nhất dùng tính điểm: {sourceDate(candidate.data_freshness_at)}</p>
      <details className="mt-3 text-sm leading-6 text-muted">
        <summary className="cursor-pointer rounded-lg py-2 font-semibold text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">Trích dẫn nguồn ({candidate.evidence_refs.length})</summary>
        <p className="mt-2">Các đoạn trích từ phiên bản nguồn bất biến đã được đối chiếu phía máy chủ. Điểm do quy tắc tính toán, không phải phần trăm chắc chắn của AI.</p>
        <ol className="mt-3 space-y-3">
          {candidate.evidence_refs.map((ref, index) => (
            <li key={`${ref.block_id}-${ref.char_start}-${ref.char_end}`} className="min-w-0 rounded-xl border border-border bg-background p-3">
              <p className="text-xs font-semibold text-primary">Nguồn {index + 1}</p>
              <blockquote className="mt-1 whitespace-pre-wrap wrap-anywhere text-ink">{ref.quote}</blockquote>
              <p className="mt-2 text-xs">Dùng cho: {candidate.score_factors.filter((factor) => factor.evidence_refs.some((source) => source.block_id === ref.block_id && source.source_version_id === ref.source_version_id && source.char_start === ref.char_start && source.char_end === ref.char_end)).map((factor) => factorLabels[factor.code]).join(", ")}</p>
            </li>
          ))}
        </ol>
      </details>
    </Card>
  );
}

const ragSourceLabels: Record<RagSearchCandidate["evidence"][number]["source_type"], string> = {
  profile: "Hồ sơ",
  skill: "Kỹ năng",
  experience: "Kinh nghiệm",
  project: "Dự án",
};

function RagCandidateCard({ candidate }: { candidate: RagSearchCandidate }) {
  return (
    <Card className="min-w-0 p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="wrap-anywhere text-base font-bold text-ink">{candidate.name}</h3>
          <p className="mt-0.5 wrap-anywhere text-sm text-muted">{candidate.title ?? "Chưa có chức danh"}</p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {candidate.matched_terms.map((term) => <Badge key={term} tone="ai">{term}</Badge>)}
        </div>
      </div>
      <p className="mt-3 text-sm leading-6 text-ink">{candidate.reason}</p>
      <div className="mt-4 border-t border-border pt-4">
        <p className="text-xs font-semibold uppercase tracking-[0.1em] text-muted">Bằng chứng đã truy xuất</p>
        <ul className="mt-3 space-y-2">
          {candidate.evidence.map((evidence) => (
            <li key={evidence.source_id} className="rounded-xl border border-border bg-background p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-semibold text-ink">{evidence.label}</p>
                <div className="flex items-center gap-1.5">
                  <Badge tone="neutral">{ragSourceLabels[evidence.source_type]}</Badge>
                  <Badge tone={evidence.verified ? "success" : "warning"}>{evidence.verified ? "Đã xác minh" : "Tự khai báo"}</Badge>
                </div>
              </div>
              <p className="mt-2 whitespace-pre-wrap wrap-anywhere text-sm leading-6 text-muted">{evidence.excerpt}</p>
            </li>
          ))}
        </ul>
      </div>
    </Card>
  );
}

function RagResultsBody({ data }: { data: RagSearchResponse }) {
  if (data.status === "empty") {
    return <div className="mt-4"><EmptyState title="Chưa tìm thấy hồ sơ phù hợp" description="Hãy thử nêu rõ kỹ năng, vai trò, dự án hoặc lĩnh vực cần tìm." /></div>;
  }
  return (
    <div className="mt-4 space-y-4">
      <Card className="border-[#E5DFFF] bg-white p-4 sm:p-5">
        <div className="flex items-center gap-2"><Sparkles size={16} className="text-violet-strong" aria-hidden="true" /><h2 className="text-sm font-semibold text-ink">Câu trả lời dựa trên hồ sơ</h2></div>
        <p className="mt-2 text-sm leading-6 text-ink">{data.answer}</p>
        <p className="mt-2 text-xs text-muted">
          {data.answer_source === "ai"
            ? "AI chỉ tổng hợp từ các bằng chứng bên dưới; thứ tự ứng viên do bước truy xuất xác định."
            : "AI phản hồi chậm hoặc chưa khả dụng; hệ thống vẫn trả kết quả truy xuất từ hồ sơ, không tự thêm ứng viên."}
        </p>
      </Card>
      <div>
        <h2 className="text-sm font-semibold text-ink">{data.candidates.length} nhân sự có bằng chứng phù hợp</h2>
        <p className="mt-1 text-xs text-muted">Truy xuất trong công ty hiện tại · chỉ dùng dữ liệu bạn được phép xem</p>
      </div>
      <ul aria-label="Kết quả RAG" className="grid items-start gap-3 xl:grid-cols-2">
        {data.candidates.map((candidate) => <li key={candidate.user_id} className="min-w-0"><RagCandidateCard candidate={candidate} /></li>)}
      </ul>
    </div>
  );
}

function ResultsBody({ data, onRetry, layout, onLayoutChange }: { data: PeopleSearchResponse; onRetry: () => void; layout: ResultLayout; onLayoutChange: (layout: ResultLayout) => void }) {
  if (data.status === "insufficient_evidence") {
    return <Card className="mt-4 border-border bg-background p-5" role="status"><h2 className="text-sm font-semibold text-ink">Chưa đủ bằng chứng để tìm kiếm</h2><p className="mt-2 text-sm leading-6 text-muted">Dữ liệu chuẩn hóa hoặc nguồn xác minh chưa sẵn sàng. Chưa thể kết luận có nhân sự phù hợp hay không; hãy bổ sung, xác minh hồ sơ rồi tìm lại.</p></Card>;
  }
  if (data.status === "needs_clarification") {
    return (
      <Card className="mt-4 border-[#F1EEFF] bg-[#F7F5FF] p-5" role="status">
        <p className="text-sm font-semibold text-violet-strong">Cần làm rõ thêm truy vấn</p>
        <p className="mt-1 text-sm leading-6 text-ink">{data.plan.clarification_reason ?? "Vui lòng bổ sung kỹ năng, kinh nghiệm hoặc vai trò bắt buộc."}</p>
      </Card>
    );
  }

  if (data.status === "provider_failure") {
    return (
      <div className="mt-4">
        <ErrorState
          title="Không thể tạo kết quả bằng AI"
          description="Dịch vụ AI không xử lý được yêu cầu. Bạn có thể thử lại với cùng tiêu chí."
          onRetry={onRetry}
        />
      </div>
    );
  }

  if (data.status === "empty") return <div className="mt-4"><EmptyState title="Không tìm thấy nhân sự phù hợp" description="Hãy thử mô tả khác hoặc nới rộng tiêu chí tìm kiếm." /></div>;

  return (
    <div className="mt-4 space-y-4">
      {data.explanation || data.explanation_source === "deterministic_fallback" ? (
        <Card className="p-4 sm:p-5">
          <div className="flex items-center gap-2"><Sparkles size={16} className="text-primary" aria-hidden="true" /><h2 className="text-sm font-semibold text-ink">Giải thích kết quả</h2></div>
          {data.explanation ? <p className="mt-2 text-sm leading-6 text-muted">{data.explanation}</p> : null}
          {data.explanation_source === "deterministic_fallback" ? <p className="mt-2 text-xs text-muted">Giải thích AI chưa khả dụng vì chưa có tích hợp bằng chứng đầy đủ. Kết quả chỉ dùng quy tắc tính điểm cố định và bằng chứng bên dưới.</p> : null}
        </Card>
      ) : null}
      {data.candidates.length > 0 ? (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold text-ink">{data.candidates.length} nhân sự</h2>
              <p className="mt-1 text-xs text-muted">Theo thứ tự điểm từ máy chủ · đổi cách xem không đổi kết quả</p>
            </div>
            <div role="group" aria-label="Cách hiển thị kết quả" className="flex flex-wrap gap-1 rounded-2xl border border-border bg-surface p-1">
              <Button type="button" variant={layout === "cards" ? "primary" : "ghost"} aria-pressed={layout === "cards"} onClick={() => onLayoutChange("cards")} className="focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary motion-reduce:transition-none"><LayoutGrid size={16} aria-hidden="true" />Dạng thẻ</Button>
              <Button type="button" variant={layout === "compact" ? "primary" : "ghost"} aria-pressed={layout === "compact"} onClick={() => onLayoutChange("compact")} className="focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary motion-reduce:transition-none"><List size={16} aria-hidden="true" />Danh sách gọn</Button>
            </div>
          </div>
          <ul aria-label="Kết quả tìm kiếm" className={layout === "compact" ? "divide-y divide-border rounded-2xl border border-border bg-surface [&>li:first-child>div]:rounded-t-2xl [&>li:last-child>div]:rounded-b-2xl" : "grid items-start gap-3 xl:grid-cols-2"}>
            {data.candidates.map((candidate) => (
              <li key={candidate.score_version === "people-search-canonical-v1" ? candidate.candidate_id : candidate.user_id} className="min-w-0">
                {candidate.score_version === "people-search-canonical-v1" ? <CanonicalCandidateCard candidate={candidate} layout={layout} /> : <CandidateCard candidate={candidate} layout={layout} />}
              </li>
            ))}
          </ul>
        </>
      ) : <EmptyState title="Không tìm thấy nhân sự phù hợp" description="Hãy thử mô tả khác hoặc nới rộng tiêu chí tìm kiếm." />}
    </div>
  );
}

function SearchFeedback({ state, mode, layout, onLayoutChange, onRetry }: { state: SearchState; mode: SearchMode; layout: ResultLayout; onLayoutChange: (layout: ResultLayout) => void; onRetry: () => void }) {
  if (state.mode !== mode || state.status === "idle") return null;
  const criteriaData = state.data && "plan" in state.data ? state.data : undefined;
  const ragData = state.data && "retrieval_mode" in state.data ? state.data : undefined;
  const content = (
    <>
      {state.status === "loading" ? <LoadingState label={mode === "assistant" ? "Milo đang phân tích nhu cầu và đối chiếu nhân sự" : "Đang tìm kiếm nhân sự"} /> : null}
      {state.status === "error" ? <ErrorState title="Không thể thực hiện tìm kiếm" description={state.error ?? "Kết nối dịch vụ tìm kiếm đang gián đoạn."} onRetry={onRetry} /> : null}
      {state.status === "success" && criteriaData ? <><SearchInterpretationPanel interpretation={criteriaData.plan.interpretation} needsClarification={criteriaData.plan.needs_clarification} /><UnsupportedBanner reasons={criteriaData.unsupported_reasons} /><ResultsBody data={criteriaData} layout={layout} onLayoutChange={onLayoutChange} onRetry={onRetry} /></> : null}
      {state.status === "success" && ragData ? <RagResultsBody data={ragData} /> : null}
    </>
  );

  if (mode === "criteria") return <div className="mt-4">{content}</div>;
  return (
    <div className="mt-5 space-y-4" aria-live="polite">
      {state.query ? <div className="ml-auto max-w-2xl rounded-2xl rounded-br-md bg-primary px-4 py-3 text-sm leading-6 text-white"><p className="sr-only">Câu hỏi của bạn:</p>{state.query}</div> : null}
      <div className="max-w-4xl rounded-2xl rounded-tl-md border border-[#E5DFFF] bg-[#F8F6FF] p-4 sm:p-5">
        <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-violet-strong"><span className="grid size-8 place-items-center rounded-xl bg-white shadow-sm"><Sparkles size={16} aria-hidden="true" /></span>Milo People Intelligence</div>
        {state.status === "success" ? <p className="text-sm leading-6 text-ink">Mình đã truy xuất dữ liệu hồ sơ trong phạm vi bạn được phép xem và tổng hợp câu trả lời từ các bằng chứng đó.</p> : null}
        {content}
      </div>
    </div>
  );
}

export function PeopleSearchView() {
  const { session } = useAuth();
  const params = useSearchParams();
  const [companyId, setCompanyId] = useState(params?.get("companyId") ?? "");
  const companies = useQuery({ queryKey: ["company-options", session?.user.id], queryFn: () => listAvailableCompanies(session!), enabled: session?.user.role === "SUPER_ADMIN" });
  const [mode, setMode] = useState<SearchMode>("criteria");
  const [filters, setFilters] = useState(initialFilters);
  const [assistantQuestion, setAssistantQuestion] = useState("");
  const [resultLayout, setResultLayout] = useState<ResultLayout>("cards");
  const [state, setState] = useState<SearchState>({ status: "idle" });
  const lastRequest = useRef<{ query: string; mode: SearchMode } | null>(null);
  const requestId = useRef(0);
  const controller = useRef<AbortController | null>(null);
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);

  useEffect(() => () => controller.current?.abort(), []);

  const runSearch = async (query: string, requestMode: SearchMode) => {
    if (!session) return;
    controller.current?.abort();
    const currentId = ++requestId.current;
    const nextController = new AbortController();
    controller.current = nextController;
    lastRequest.current = { query, mode: requestMode };
    setState({ status: "loading", mode: requestMode, query });
    try {
      const request = { query, accessToken: session.accessToken, signal: nextController.signal, companyId: session.user.role === "SUPER_ADMIN" ? companyId : undefined };
      const data = requestMode === "assistant" ? await askPeople(request) : await searchPeople(request);
      if (currentId === requestId.current) setState({ status: "success", mode: requestMode, query, data });
    } catch (error) {
      if (nextController.signal.aborted || currentId !== requestId.current) return;
      setState({ status: "error", mode: requestMode, query, error: error instanceof Error ? error.message : "Không thể thực hiện tìm kiếm." });
    }
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const compiled = compileQuery(filters);
    if (compiled) void runSearch(compiled, "criteria");
  };

  const handleAssistantSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const question = assistantQuestion.trim();
    if (question) void runSearch(question, "assistant");
  };

  const handleTabKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    event.preventDefault();
    const nextIndex = (index + (event.key === "ArrowRight" ? 1 : -1) + 2) % 2;
    const nextMode: SearchMode = nextIndex === 0 ? "criteria" : "assistant";
    setMode(nextMode);
    tabRefs.current[nextIndex]?.focus();
  };

  const retryLastRequest = () => {
    const captured = lastRequest.current;
    if (captured) void runSearch(captured.query, captured.mode);
  };

  const setFilter = (key: keyof PeopleSearchFilters, value: string) => setFilters((current) => ({ ...current, [key]: value }));
  const canSearch = Boolean(session?.user.permissions.includes("people:read"));

  if (!canSearch) return <ErrorState title="Không có quyền tìm kiếm nhân sự" description="Tài khoản hiện tại không có quyền people:read." />;

  return (
    <div>
      {session?.user.role === "SUPER_ADMIN" ? <label className="mb-6 block max-w-xl text-sm font-semibold">Công ty tìm kiếm<select className="mt-2 min-h-11 w-full rounded-xl border border-border bg-surface px-3" value={companyId} onChange={(event) => { controller.current?.abort(); requestId.current += 1; setCompanyId(event.target.value); setState({ status: "idle" }); }}><option value="">Chọn công ty</option>{companies.data?.map((company) => <option key={company.id} value={company.id}>{company.name}</option>)}</select>{companies.isError ? <span role="alert" className="mt-2 block text-danger">Chưa tải được công ty. Hãy tải lại trang.</span> : null}</label> : null}
      <header>
        <Badge tone="ai">People Intelligence</Badge>
        <h1 className="mt-3 text-balance text-2xl font-bold tracking-[-0.03em] text-ink sm:text-3xl">Tìm kiếm nhân sự</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">Tìm theo tiêu chí cụ thể hoặc hỏi AI bằng ngôn ngữ tự nhiên. Hệ thống chỉ xếp hạng theo dữ liệu có bằng chứng.</p>
        <p className="mt-3 max-w-2xl rounded-xl border border-border bg-background p-3 text-sm leading-6 text-muted">
          RAG hồ sơ có cấu trúc đang bật: Milo truy xuất kỹ năng, kinh nghiệm và dự án trong phạm vi công ty. Dữ liệu tự khai báo luôn được gắn nhãn; nếu AI phản hồi chậm, hệ thống vẫn trả kết quả truy xuất mà không tự thêm ứng viên.
        </p>
      </header>

      <div className="mt-6 border-b border-border">
        <div role="tablist" aria-label="Cách tìm kiếm nhân sự" className="flex gap-6">
          {([{ value: "criteria", label: "Tìm theo yêu cầu", icon: SlidersHorizontal }, { value: "assistant", label: "Hỏi AI", icon: MessageSquareText }] as const).map((tab, index) => {
            const Icon = tab.icon;
            const selected = mode === tab.value;
            return <button key={tab.value} ref={(node) => { tabRefs.current[index] = node; }} type="button" role="tab" id={`people-search-tab-${tab.value}`} aria-controls={`people-search-panel-${tab.value}`} aria-selected={selected} tabIndex={selected ? 0 : -1} onClick={() => setMode(tab.value)} onKeyDown={(event) => handleTabKeyDown(event, index)} className={`relative flex min-h-12 items-center gap-2 px-1 text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary motion-reduce:transition-none ${selected ? "text-primary" : "text-muted hover:text-ink"}`}><Icon size={17} aria-hidden="true" />{tab.label}<span aria-hidden="true" className={`absolute inset-x-0 -bottom-px h-0.5 rounded-full bg-primary transition-opacity motion-reduce:transition-none ${selected ? "opacity-100" : "opacity-0"}`} /></button>;
          })}
        </div>
      </div>

      {mode === "criteria" ? <section role="tabpanel" id="people-search-panel-criteria" aria-labelledby="people-search-tab-criteria">
        <Card className="mt-6 p-4 sm:p-5">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="people-query" className="mb-1 block text-sm font-semibold text-ink">Mô tả yêu cầu</label>
              <Input id="people-query" value={filters.query} onChange={(event) => setFilter("query", event.target.value)} placeholder="Ai có kinh nghiệm React trên 2 năm..." aria-label="Mô tả yêu cầu tìm kiếm nhân sự" />
            </div>
            <fieldset className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <legend className="mb-2 text-sm font-semibold text-ink">Bộ lọc có cấu trúc</legend>
              <Input aria-label="Kỹ năng bắt buộc" value={filters.requiredSkills} onChange={(event) => setFilter("requiredSkills", event.target.value)} placeholder="Kỹ năng bắt buộc" />
              <Input aria-label="Kỹ năng ưu tiên" value={filters.preferredSkills} onChange={(event) => setFilter("preferredSkills", event.target.value)} placeholder="Kỹ năng ưu tiên" />
              <Input aria-label="Số năm kinh nghiệm tối thiểu" type="number" min="0" max="60" step="0.5" value={filters.minExperienceYears} onChange={(event) => setFilter("minExperienceYears", event.target.value)} placeholder="Số năm kinh nghiệm" />
              <Input aria-label="Domain bắt buộc" value={filters.domains} onChange={(event) => setFilter("domains", event.target.value)} placeholder="Domain bắt buộc" />
              <label className="text-sm text-ink"><span className="sr-only">Trạng thái sẵn sàng</span><select aria-label="Trạng thái sẵn sàng" className="h-12 w-full rounded-xl border border-border bg-white px-4" value={filters.availability} onChange={(event) => setFilter("availability", event.target.value)}><option value="">Mọi trạng thái sẵn sàng</option><option value="AVAILABLE">Sẵn sàng ngay</option><option value="AVAILABLE_SOON">Sắp sẵn sàng</option></select></label>
            </fieldset>
            <Button type="submit" disabled={state.status === "loading" || compileQuery(filters).length === 0}><Search size={16} aria-hidden="true" /> Tìm kiếm</Button>
          </form>
        </Card>
        <SearchFeedback state={state} mode="criteria" layout={resultLayout} onLayoutChange={setResultLayout} onRetry={retryLastRequest} />
      </section> : null}

      {mode === "assistant" ? <section role="tabpanel" id="people-search-panel-assistant" aria-labelledby="people-search-tab-assistant" className="pt-6">
        <Card className="overflow-hidden border-[#E5DFFF] p-0">
          <div className="border-b border-[#E5DFFF] bg-[#F8F6FF] p-4 sm:p-5"><div className="flex items-start gap-3"><span className="grid size-10 shrink-0 place-items-center rounded-2xl bg-white text-violet-strong shadow-sm"><Sparkles size={19} aria-hidden="true" /></span><div><h2 className="font-bold text-ink">Hỏi Milo để tìm đúng người</h2><p className="mt-1 max-w-2xl text-sm leading-6 text-muted">Mô tả công việc, kỹ năng hoặc thời điểm cần người. Milo sẽ làm rõ tiêu chí và trả về ứng viên dựa trên dữ liệu bạn được phép xem.</p></div></div></div>
          <div className="p-4 sm:p-5">
            {state.mode !== "assistant" || state.status === "idle" ? <div className="mb-5"><p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted">Gợi ý câu hỏi</p><div className="mt-3 flex flex-wrap gap-2">{assistantPrompts.map((prompt) => <button key={prompt} type="button" onClick={() => setAssistantQuestion(prompt)} className="rounded-full border border-border bg-background px-3 py-2 text-left text-xs font-medium text-ink transition-colors hover:border-primary hover:bg-primary-subtle focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary motion-reduce:transition-none">{prompt}</button>)}</div></div> : null}
            <form onSubmit={handleAssistantSubmit} className="flex flex-col gap-3 sm:flex-row sm:items-end">
              <label htmlFor="people-ai-question" className="min-w-0 flex-1"><span className="mb-1 block text-sm font-semibold text-ink">Bạn đang cần tìm ai?</span><textarea id="people-ai-question" aria-label="Câu hỏi cho AI" rows={3} maxLength={1200} value={assistantQuestion} onChange={(event) => setAssistantQuestion(event.target.value)} placeholder="Ví dụ: Ai phù hợp dẫn dắt dự án React trong quý tới?" className="min-h-24 w-full resize-y rounded-2xl border border-border bg-white px-4 py-3 text-sm leading-6 text-ink outline-none transition-shadow placeholder:text-muted focus:border-primary focus:ring-2 focus:ring-primary/20 motion-reduce:transition-none" /></label>
              <Button type="submit" disabled={state.status === "loading" || assistantQuestion.trim().length === 0} className="min-h-12 shrink-0 sm:mb-0.5"><Send size={16} aria-hidden="true" />Hỏi AI</Button>
            </form>
          </div>
        </Card>
        <SearchFeedback state={state} mode="assistant" layout={resultLayout} onLayoutChange={setResultLayout} onRetry={retryLastRequest} />
      </section> : null}
    </div>
  );
}
