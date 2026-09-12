"use client";

import { AlertTriangle, LayoutGrid, List, Search, Sparkles } from "lucide-react";
import { useEffect, useRef, useState, type FormEvent } from "react";

import { EmptyState, ErrorState, LoadingState } from "@/components/ui/app-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/features/auth/auth-provider";
import {
  compileQuery,
  searchPeople,
  type LegacyPeopleSearchCandidate,
  type PeopleSearchFilters,
  type PeopleSearchResponse,
} from "@/features/people-search/people-search-api";
import type { CanonicalSearchCandidate } from "./canonical-search-schema";
import { SearchInterpretationPanel } from "./search-interpretation-panel";

type ResultLayout = "cards" | "compact";

const initialFilters: PeopleSearchFilters = {
  query: "",
  requiredSkills: "",
  preferredSkills: "",
  minExperienceYears: "",
  domains: "",
  availability: "",
};

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

export function PeopleSearchView() {
  const { session } = useAuth();
  const [filters, setFilters] = useState(initialFilters);
  const [resultLayout, setResultLayout] = useState<ResultLayout>("cards");
  const [state, setState] = useState<{ status: "idle" | "loading" | "success" | "error"; data?: PeopleSearchResponse; error?: string }>({ status: "idle" });
  const lastRequest = useRef<string | null>(null);
  const requestId = useRef(0);
  const controller = useRef<AbortController | null>(null);

  useEffect(() => () => controller.current?.abort(), []);

  const runSearch = async (query: string) => {
    if (!session) return;
    controller.current?.abort();
    const currentId = ++requestId.current;
    const nextController = new AbortController();
    controller.current = nextController;
    lastRequest.current = query;
    setState({ status: "loading" });
    try {
      const data = await searchPeople({ query, accessToken: session.accessToken, signal: nextController.signal });
      if (currentId === requestId.current) setState({ status: "success", data });
    } catch (error) {
      if (nextController.signal.aborted || currentId !== requestId.current) return;
      setState({ status: "error", error: error instanceof Error ? error.message : "Không thể thực hiện tìm kiếm." });
    }
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const compiled = compileQuery(filters);
    if (compiled) void runSearch(compiled);
  };

  const setFilter = (key: keyof PeopleSearchFilters, value: string) => setFilters((current) => ({ ...current, [key]: value }));
  const canSearch = Boolean(session?.user.permissions.includes("people:read"));

  if (!canSearch) return <ErrorState title="Không có quyền tìm kiếm nhân sự" description="Tài khoản hiện tại không có quyền people:read." />;

  return (
    <div>
      <header>
        <Badge tone="ai">People Intelligence</Badge>
        <h1 className="mt-3 text-balance text-2xl font-bold tracking-[-0.03em] text-ink sm:text-3xl">Tìm kiếm nhân sự</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">Mô tả nhu cầu và thêm bộ lọc có cấu trúc. Hệ thống chỉ xếp hạng theo dữ liệu có bằng chứng.</p>
        <p className="mt-3 max-w-2xl rounded-xl border border-border bg-background p-3 text-sm leading-6 text-muted">
          Bản tích hợp thử nghiệm: dữ liệu kỹ năng, lĩnh vực và mức độ sẵn sàng đã xác minh chưa được nối đầy đủ. Hệ thống sẽ báo thiếu dữ liệu thay vì tự suy đoán kết quả. Tìm kiếm AI cần cấu hình dịch vụ phía máy chủ.
        </p>
      </header>

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

      {state.status === "loading" ? <div className="mt-4"><LoadingState label="Đang tìm kiếm nhân sự" /></div> : null}
      {state.status === "error" ? <div className="mt-4"><ErrorState title="Không thể thực hiện tìm kiếm" description={state.error ?? "Kết nối dịch vụ tìm kiếm đang gián đoạn."} onRetry={() => { const captured = lastRequest.current; if (captured) void runSearch(captured); }} /></div> : null}
      {state.status === "success" && state.data ? <><SearchInterpretationPanel interpretation={state.data.plan.interpretation} needsClarification={state.data.plan.needs_clarification} /><UnsupportedBanner reasons={state.data.unsupported_reasons} /><ResultsBody data={state.data} layout={resultLayout} onLayoutChange={setResultLayout} onRetry={() => { const captured = lastRequest.current; if (captured) void runSearch(captured); }} /></> : null}
    </div>
  );
}
