"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  Clock3,
  FileCheck2,
  FileSearch,
  FileText,
  Info,
  LoaderCircle,
  RefreshCcw,
  ShieldCheck,
  Sparkles,
  UploadCloud,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useRef, useState, type ChangeEvent, type DragEvent, type FormEvent } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { ErrorState, LoadingState } from "@/components/ui/app-state";
import { useAuth } from "@/features/auth/auth-provider";
import {
  ApiError,
  ProfileConflictError,
  applyProfileImport,
  createProfileImport,
  getProfileImport,
  listProfileImports,
  parseProfileImport,
  type AiStatus,
  type ProfileApplyRead,
  type ProfileConflict,
  type ProfileImportDetail,
  type ProfileImportStatus,
  type ProfileProposalItem,
} from "@/lib/api";
import { cn } from "@/lib/cn";

export type ProfileImportForcedState = "loading" | "empty" | "error" | "stale";

const acceptedExtensions = ["pdf", "docx", "png", "jpg", "jpeg", "webp", "txt", "csv", "xlsx"];
const maxFileSize = 10 * 1024 * 1024;

const statusDetails: Record<ProfileImportStatus, { label: string; tone: "neutral" | "success" | "warning" | "ai"; description: string }> = {
  PENDING: { label: "Chờ phân tích", tone: "warning", description: "Tài liệu đã an toàn và sẵn sàng để AI đề xuất thông tin." },
  PROCESSING: { label: "Đang phân tích", tone: "ai", description: "CareerMate đang đối chiếu nội dung với nguồn trong tài liệu." },
  PARSED: { label: "Chờ bạn duyệt", tone: "ai", description: "Đề xuất đã sẵn sàng. Hồ sơ chưa bị thay đổi." },
  APPLIED: { label: "Đã cập nhật", tone: "success", description: "Những mục bạn chọn đã được ghi vào hồ sơ." },
  FAILED: { label: "Cần thử lại", tone: "warning", description: "Lần phân tích trước chưa hoàn tất. Bạn có thể thử lại." },
};

const aiStatusDetails: Record<AiStatus, { title: string; description: string; tone: string; icon: typeof CheckCircle2 }> = {
  ok: {
    title: "AI đã tạo đề xuất có dẫn nguồn",
    description: "Kiểm tra từng mục trước khi chọn cập nhật hồ sơ.",
    tone: "border-[#D7E7DA] bg-[#F5FAF6] text-sage-strong",
    icon: CheckCircle2,
  },
  needs_clarification: {
    title: "AI cần bạn làm rõ thêm",
    description: "Tài liệu chưa đủ rõ để tạo đề xuất an toàn.",
    tone: "border-[#F0DFC0] bg-[#FFFAF0] text-[#80520F]",
    icon: Info,
  },
  insufficient_evidence: {
    title: "Chưa đủ minh chứng",
    description: "Không có dữ liệu nào được chọn hoặc ghi vào hồ sơ.",
    tone: "border-[#F0DFC0] bg-[#FFFAF0] text-[#80520F]",
    icon: FileSearch,
  },
  failed: {
    title: "Phân tích chưa hoàn tất",
    description: "Bạn có thể thử lại. Hồ sơ hiện tại vẫn được giữ nguyên.",
    tone: "border-[#F6D5D2] bg-danger-soft text-danger",
    icon: AlertCircle,
  },
};

const fieldLabels: Record<string, string> = {
  jobTitle: "Chức danh hiện tại",
  summary: "Giới thiệu chuyên môn",
  skill: "Kỹ năng",
  experience: "Kinh nghiệm",
  project: "Dự án",
  certification: "Chứng chỉ",
  award: "Thành tích",
};

function formatFileSize(value: number) {
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${Math.round(value / 1024)} KB`;
  return `${(value / (1024 * 1024)).toLocaleString("vi-VN", { maximumFractionDigits: 1 })} MB`;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}

function formatMimeType(value: string) {
  const labels: Record<string, string> = {
    "text/plain": "Tệp văn bản",
    "text/csv": "Bảng CSV",
    "application/csv": "Bảng CSV",
    "application/pdf": "Tài liệu PDF",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "Tài liệu Word",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "Bảng Excel",
    "image/png": "Ảnh PNG",
    "image/jpeg": "Ảnh JPEG",
    "image/webp": "Ảnh WebP",
  };
  return labels[value] ?? "Tài liệu";
}

function validateFile(file: File) {
  const extension = file.name.split(".").pop()?.toLowerCase();
  if (!extension || !acceptedExtensions.includes(extension)) {
    return "Định dạng này chưa được hỗ trợ. Chọn PDF, DOCX, ảnh, TXT, CSV hoặc XLSX.";
  }
  if (file.size === 0) return "Tài liệu đang trống. Hãy chọn một file có nội dung.";
  if (file.size > maxFileSize) return "Tài liệu vượt quá 10 MB. Hãy giảm dung lượng rồi thử lại.";
  return null;
}

function StatusBadge({ status }: { status: ProfileImportStatus }) {
  const detail = statusDetails[status];
  return <Badge tone={detail.tone}>{status === "PROCESSING" ? <LoaderCircle size={13} className="animate-spin" aria-hidden="true" /> : null}{detail.label}</Badge>;
}

function MiloImportGuide() {
  return (
    <aside aria-label="Gợi ý từ Milo" className="mt-5 flex max-w-2xl items-center gap-3 rounded-2xl border border-[#E4DFF8] bg-[#FAF8FF] px-4 py-3">
      <span className="relative size-16 shrink-0 self-end sm:size-20">
        <Image
          src="/brand/milo/milo-purple-tablet.webp"
          alt="Milo nhắc bạn kiểm tra minh chứng"
          fill
          loading="eager"
          sizes="(min-width: 640px) 80px, 64px"
          className="object-contain object-bottom"
        />
      </span>
      <div>
        <p className="text-sm font-bold text-ink">Milo nhắc bạn</p>
        <p className="mt-1 text-sm leading-6 text-muted">Đọc từng minh chứng trước khi cập nhật. Tài liệu không bao giờ tự thay đổi hồ sơ.</p>
      </div>
    </aside>
  );
}

export function AiStatusNotice({ status, questions = [], warnings = [] }: { status: AiStatus; questions?: string[]; warnings?: string[] }) {
  const detail = aiStatusDetails[status];
  const Icon = detail.icon;
  return (
    <section role={status === "failed" ? "alert" : "status"} className={cn("rounded-2xl border p-4", detail.tone)}>
      <div className="flex items-start gap-3">
        {status === "ok" ? (
          <span className="relative -my-1 size-14 shrink-0" aria-hidden="true">
            <Image src="/brand/milo/milo-purple-tablet.webp" alt="" fill loading="eager" sizes="56px" className="object-contain" />
          </span>
        ) : <Icon className="mt-0.5 shrink-0" size={20} aria-hidden="true" />}
        <div>
          <h2 className="text-sm font-bold">{detail.title}</h2>
          <p className="mt-1 text-sm leading-6">{detail.description}</p>
          {questions.length > 0 ? (
            <ul className="mt-3 list-disc space-y-1 pl-5 text-sm leading-6">
              {questions.map((question) => <li key={question}>{question}</li>)}
            </ul>
          ) : null}
          {warnings.map((warning) => {
            const message = warning === "DEMO_DATA"
              ? "Đây là dữ liệu mẫu chạy sẵn để bạn xem luồng; CareerMate chưa gửi tài liệu tới dịch vụ AI."
              : warning.startsWith("FALLBACK_USED:")
                ? "Đã dùng phương án dự phòng xác định vì dịch vụ AI tạm thời không khả dụng."
                : "Kết quả có cảnh báo kỹ thuật. Hãy kiểm tra kỹ nguồn trước khi lưu.";
            return <p className="mt-2 text-sm font-semibold" key={warning}>Cảnh báo: {message}</p>;
          })}
        </div>
      </div>
    </section>
  );
}

function FilePicker({ file, error, busy, onFile }: { file: File | null; error: string | null; busy: boolean; onFile: (file: File | null) => void }) {
  const [dragging, setDragging] = useState(false);

  function acceptFile(candidate: File | null) {
    setDragging(false);
    onFile(candidate);
  }

  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    acceptFile(event.target.files?.[0] ?? null);
    event.target.value = "";
  }

  function handleDrop(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    if (!busy) acceptFile(event.dataTransfer.files?.[0] ?? null);
  }

  return (
    <div>
      <input
        id="profile-import-file"
        className="peer sr-only"
        type="file"
        accept=".pdf,.docx,.png,.jpg,.jpeg,.webp,.txt,.csv,.xlsx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,image/png,image/jpeg,image/webp,text/plain,text/csv"
        onChange={handleChange}
        disabled={busy}
        aria-describedby="profile-import-file-hint profile-import-file-error"
        aria-invalid={Boolean(error)}
      />
      <label
        htmlFor="profile-import-file"
        onDragEnter={(event) => { event.preventDefault(); if (!busy) setDragging(true); }}
        onDragOver={(event) => event.preventDefault()}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        className={cn(
          "group flex min-h-52 cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed px-5 py-8 text-center transition-colors peer-focus-visible:outline peer-focus-visible:outline-3 peer-focus-visible:outline-offset-3 peer-focus-visible:outline-primary",
          dragging ? "border-primary bg-[#F0F5F8]" : "border-[#CBD5DC] bg-background/55 hover:border-primary hover:bg-[#F4F7F8]",
          error && "border-danger bg-danger-soft",
          busy && "cursor-wait opacity-70",
        )}
      >
        <span className="grid size-12 place-items-center rounded-2xl bg-white text-primary shadow-sm" aria-hidden="true">
          {file ? <FileCheck2 size={24} /> : <UploadCloud size={24} />}
        </span>
        <span className="mt-4 text-sm font-bold text-ink">{file ? file.name : "Chọn hoặc thả tài liệu vào đây"}</span>
        <span className="mt-2 max-w-md text-xs leading-5 text-muted">
          {file ? `${formatFileSize(file.size)} · Chọn file khác nếu cần` : "PDF, DOCX, PNG, JPG, WebP, TXT, CSV hoặc XLSX · tối đa 10 MB"}
        </span>
        <span className="mt-4 rounded-xl border border-border bg-white px-4 py-2 text-xs font-semibold text-primary group-hover:border-primary">Duyệt trên thiết bị</span>
      </label>
      <p id="profile-import-file-hint" className="sr-only">File được quét an toàn và chỉ dùng để tạo đề xuất. AI không tự cập nhật hồ sơ.</p>
      <p id="profile-import-file-error" className={cn("mt-3 text-sm font-medium text-danger", !error && "sr-only")}>{error ?? "Không có lỗi file"}</p>
    </div>
  );
}

export function ProfileImportListView({ forceState }: { forceState?: ProfileImportForcedState }) {
  const { session } = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [file, setFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const errorSummaryRef = useRef<HTMLDivElement>(null);

  const imports = useQuery({
    queryKey: ["profile-imports", session?.user.id],
    queryFn: () => listProfileImports(session!),
    enabled: Boolean(session) && !forceState,
  });
  const upload = useMutation({
    mutationFn: (candidate: File) => createProfileImport(session!, candidate),
    onSuccess: (created) => {
      router.push(`/ho-so/import/${created.id}`);
      void queryClient.invalidateQueries({ queryKey: ["profile-imports", session?.user.id] });
    },
  });

  function chooseFile(candidate: File | null) {
    setFile(candidate);
    setFileError(candidate ? validateFile(candidate) : null);
    upload.reset();
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    const nextError = file ? validateFile(file) : "Hãy chọn một tài liệu trước khi tiếp tục.";
    if (!file || nextError) {
      setFileError(nextError);
      window.requestAnimationFrame(() => errorSummaryRef.current?.focus());
      return;
    }
    upload.mutate(file);
  }

  const list = forceState === "empty" ? [] : imports.data?.items ?? [];

  return (
    <div>
      <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2"><Badge tone="neutral">Hồ sơ 360°</Badge><span className="text-xs text-muted">Bạn kiểm soát mọi thay đổi</span></div>
          <h1 className="mt-3 text-balance text-2xl font-bold tracking-[-0.03em] text-ink sm:text-3xl">Nhập hồ sơ từ tài liệu</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">Tải CV, hồ sơ LinkedIn đã xuất hoặc bảng dữ liệu. CareerMate chỉ đề xuất thông tin và luôn chờ bạn duyệt.</p>
        </div>
        <Button asChild variant="secondary"><Link href="/ho-so"><ArrowLeft size={16} aria-hidden="true" /> Về hồ sơ</Link></Button>
      </header>
      <MiloImportGuide />
      <div className="mt-6 grid gap-4 xl:grid-cols-[minmax(0,0.85fr)_minmax(420px,1.15fr)]">
        <Card>
          <CardHeader>
            <p className="text-xs font-bold uppercase tracking-[0.12em] text-primary">Bước 1</p>
            <h2 className="mt-1 text-lg font-bold text-ink">Chọn tài liệu nguồn</h2>
            <p className="mt-2 text-sm leading-6 text-muted">File được kiểm tra định dạng, dung lượng và an toàn trước khi phân tích.</p>
          </CardHeader>
          <CardContent>
            <form onSubmit={submit} noValidate>
              {(fileError || upload.isError) ? (
                <div ref={errorSummaryRef} tabIndex={-1} role="alert" className="mb-4 rounded-xl border border-[#F6D5D2] bg-danger-soft p-3 text-sm text-danger">
                  <p className="font-bold">Chưa thể tải tài liệu</p>
                  <p className="mt-1 text-sm leading-6">{fileError ?? (upload.error instanceof Error ? upload.error.message : "Kiểm tra kết nối và thử lại.")}</p>
                </div>
              ) : null}
              <FilePicker file={file} error={fileError} busy={upload.isPending} onFile={chooseFile} />
              <Button className="mt-4 w-full" type="submit" disabled={upload.isPending}>
                {upload.isPending ? <><LoaderCircle size={17} className="animate-spin" aria-hidden="true" /> Đang kiểm tra tài liệu…</> : <><UploadCloud size={17} aria-hidden="true" /> Tải lên và kiểm tra</>}
              </Button>
            </form>
            <div className="mt-4 flex items-start gap-2 rounded-xl bg-[#F3F7F4] p-3 text-sm leading-6 text-sage-strong">
              <ShieldCheck size={17} className="mt-0.5 shrink-0" aria-hidden="true" />
              <p>File gốc không được hiển thị trong danh sách. Nội dung chưa bao giờ tự động ghi vào hồ sơ.</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-start justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.12em] text-primary">Tài liệu của bạn</p>
              <h2 className="mt-1 text-lg font-bold text-ink">Lịch sử nhập hồ sơ</h2>
            </div>
            {imports.data ? <Badge tone="neutral">{imports.data.total} tài liệu</Badge> : null}
          </CardHeader>
          <CardContent>
            {forceState === "loading" || (!forceState && imports.isPending) ? <LoadingState label="Đang tải lịch sử nhập hồ sơ" /> : null}
            {forceState === "error" || imports.isError ? (
              <ErrorState title="Chưa thể tải lịch sử" description="Kết nối dữ liệu đang gián đoạn. Bạn có thể thử lại mà không ảnh hưởng tài liệu đã chọn." onRetry={() => void imports.refetch()} />
            ) : null}
            {forceState !== "loading" && forceState !== "error" && (!imports.isPending || forceState === "empty") && !imports.isError && list.length === 0 ? (
              <div className="flex min-h-72 flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-background/40 p-8 text-center">
                <FileText size={28} className="text-primary" aria-hidden="true" />
                <h3 className="mt-4 text-base font-bold text-ink">Chưa có tài liệu nào</h3>
                <p className="mt-2 max-w-sm text-sm leading-6 text-muted">Chọn tài liệu ở bên trái để bắt đầu. Hồ sơ chỉ đổi sau bước duyệt cuối cùng.</p>
              </div>
            ) : null}
            {!forceState && list.length > 0 ? (
              <ul className="space-y-3" aria-label="Danh sách tài liệu đã nhập">
                {list.map((item) => {
                  const detail = statusDetails[item.status];
                  return (
                    <li key={item.id}>
                      <Link href={`/ho-so/import/${item.id}`} className="group flex min-h-24 items-center gap-3 rounded-2xl border border-border p-4 transition-colors hover:border-[#B9CBD7] hover:bg-background/45">
                        <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-[#EAF1F6] text-primary" aria-hidden="true"><FileText size={21} /></span>
                        <span className="min-w-0 flex-1">
                          <span className="flex flex-wrap items-center gap-2"><span className="text-sm font-bold text-ink [overflow-wrap:anywhere]">{item.fileName}</span><StatusBadge status={item.status} /></span>
                          <span className="mt-1 block text-xs leading-5 text-muted">{formatFileSize(item.sizeBytes)} · {formatDate(item.updatedAt)}</span>
                          <span className="mt-1 block text-sm leading-6 text-muted">{detail.description}</span>
                        </span>
                        <ArrowRight size={18} className="shrink-0 text-muted transition-colors group-hover:text-primary" aria-hidden="true" />
                      </Link>
                    </li>
                  );
                })}
              </ul>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function EvidenceList({ item }: { item: ProfileProposalItem }) {
  if (item.evidenceRefs.length === 0) {
    return <p className="mt-3 flex items-center gap-2 text-sm font-medium text-[#80520F]"><AlertCircle size={15} aria-hidden="true" /> Chưa có nguồn đủ rõ để áp dụng.</p>;
  }
  return (
    <div className="mt-4 space-y-2">
      {item.evidenceRefs.map((evidence) => (
        <details key={`${evidence.blockId}-${evidence.charStart}`} className="rounded-xl border border-border bg-background/45 px-3 py-2 open:bg-white">
          <summary className="cursor-pointer text-sm font-semibold text-primary">Xem minh chứng {evidence.pageNumber ? `· Trang ${evidence.pageNumber}` : evidence.sheetName ? `· Bảng ${evidence.sheetName}` : "trong tài liệu"}</summary>
          <blockquote className="mt-2 break-words border-l-2 border-sage pl-3 text-sm leading-6 text-muted [overflow-wrap:anywhere]">“{evidence.context || evidence.quote}”</blockquote>
          <p className="mt-2 break-words text-sm leading-6 text-muted [overflow-wrap:anywhere]">Đoạn đối chiếu: “{evidence.quote}”</p>
        </details>
      ))}
    </div>
  );
}

function ProposalItem({ item, selected, disabled, onChange }: { item: ProfileProposalItem; selected: boolean; disabled: boolean; onChange: (selected: boolean) => void }) {
  const fieldLabel = fieldLabels[item.field] ?? "Thông tin khác";
  const supportLabel = item.supportStatus === "SUPPORTED" ? "Có minh chứng" : item.supportStatus === "AMBIGUOUS" ? "Cần kiểm tra" : "Chưa đủ dữ liệu";
  return (
    <li className={cn("rounded-2xl border p-4", selected ? "border-[#AFC8B5] bg-[#F7FBF8]" : "border-border bg-white", disabled && "bg-background/50")}>
      <label className={cn("flex items-start gap-3", disabled ? "cursor-not-allowed" : "cursor-pointer")}>
        <input type="checkbox" className="mt-1 size-5 accent-[#315E81]" checked={selected} disabled={disabled} onChange={(event) => onChange(event.target.checked)} />
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-bold text-ink">{fieldLabel}</span>
            <Badge tone={item.supportStatus === "SUPPORTED" ? "success" : "warning"}>{supportLabel}</Badge>
          </span>
          <span className="mt-2 block break-words text-sm leading-6 text-ink">{item.value ?? "Không có giá trị đề xuất"}</span>
          {disabled ? <span className="mt-2 block text-xs leading-5 text-muted">Mục này bị khóa vì chưa có minh chứng hợp lệ.</span> : null}
        </span>
      </label>
      <EvidenceList item={item} />
    </li>
  );
}

function StaleState({ onRefresh, busy, conflict, refreshError }: { onRefresh: () => void; busy: boolean; conflict: ProfileConflict | null; refreshError: string | null }) {
  return (
    <Card role="alert" className="border-[#F0DFC0] bg-[#FFFAF0]">
      <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <RefreshCcw size={21} className="mt-0.5 shrink-0 text-[#80520F]" aria-hidden="true" />
          <div>
            <h2 className="text-sm font-bold text-[#80520F]">Hồ sơ đã thay đổi ở nơi khác</h2>
            <p className="mt-1 text-xs leading-5 text-[#80520F]">Tải bản mới nhất rồi kiểm tra lại lựa chọn để tránh ghi đè dữ liệu.</p>
            {conflict?.currentProfileVersion != null || conflict?.currentProposalVersion != null ? (
              <p className="mt-1 text-xs font-semibold leading-5 text-[#80520F]">Phiên mới: hồ sơ {conflict.currentProfileVersion ?? "—"}, đề xuất {conflict.currentProposalVersion ?? "—"}.</p>
            ) : null}
            {refreshError ? <p className="mt-1 text-xs font-semibold leading-5 text-danger">{refreshError}</p> : null}
          </div>
        </div>
        <Button variant="secondary" onClick={onRefresh} disabled={busy}>
          <RefreshCcw size={16} className={cn(busy && "animate-spin")} aria-hidden="true" />
          {busy ? "Đang tải bản mới…" : "Tải lại dữ liệu"}
        </Button>
      </CardContent>
    </Card>
  );
}

export function ProfileImportDetailView({ importId, forceState }: { importId: string; forceState?: ProfileImportForcedState }) {
  const { session } = useAuth();
  const queryClient = useQueryClient();
  const [parseResult, setParseResult] = useState<Awaited<ReturnType<typeof parseProfileImport>> | null>(null);
  const [selection, setSelection] = useState<Record<string, boolean>>({});
  const [receipt, setReceipt] = useState<ProfileApplyRead | null>(null);
  const [stale, setStale] = useState(forceState === "stale");
  const [conflict, setConflict] = useState<ProfileConflict | null>(null);
  const [refreshError, setRefreshError] = useState<string | null>(null);
  const [refreshingAfterConflict, setRefreshingAfterConflict] = useState(false);
  const idempotencyKey = useRef<string | null>(null);

  const detailQuery = useQuery({
    queryKey: ["profile-import", session?.user.id, importId],
    queryFn: () => getProfileImport(session!, importId),
    enabled: Boolean(session) && forceState !== "loading" && forceState !== "error",
    refetchInterval: (query) => query.state.data?.status === "PROCESSING" ? 2_000 : false,
  });

  const parse = useMutation({
    mutationFn: () => parseProfileImport(session!, importId),
    onSuccess: (result) => {
      setParseResult(result);
      queryClient.setQueryData<ProfileImportDetail>(["profile-import", session?.user.id, importId], (current) => current ? {
        ...current,
        status: result.status,
        proposalVersion: result.proposalVersion,
        profileVersion: result.profileVersion,
        aiStatus: result.aiStatus,
        clarificationQuestions: result.clarificationQuestions,
        warnings: result.warnings,
        traceId: result.traceId,
        promptVersion: result.promptVersion,
        schemaVersion: result.schemaVersion,
        model: result.model,
        proposal: result.proposal,
        updatedAt: new Date().toISOString(),
      } : current);
    },
  });

  const apply = useMutation({
    mutationFn: ({ payload, key }: { payload: Parameters<typeof applyProfileImport>[2]; key: string }) => applyProfileImport(session!, importId, payload, key),
    onSuccess: (result) => {
      setReceipt(result);
      setStale(false);
      queryClient.setQueryData<ProfileImportDetail>(["profile-import", session?.user.id, importId], (current) => current ? { ...current, status: "APPLIED", updatedAt: new Date().toISOString() } : current);
      void queryClient.invalidateQueries({ queryKey: ["profile-imports", session?.user.id] });
    },
    onError: (error) => {
      if (error instanceof ApiError && error.status === 409) {
        setConflict(error instanceof ProfileConflictError ? error.details ?? null : null);
        setRefreshError(null);
        setStale(true);
      }
    },
  });

  const detail = detailQuery.data;
  const proposalItems = useMemo(() => detail?.proposal?.items ?? [], [detail?.proposal?.items]);
  const selectedCount = useMemo(() => proposalItems.filter((item) => selection[item.proposalItemId] ?? (item.supportStatus === "SUPPORTED" && item.evidenceRefs.length > 0)).length, [proposalItems, selection]);

  function selectItem(item: ProfileProposalItem, selected: boolean) {
    setSelection((current) => ({ ...current, [item.proposalItemId]: selected }));
    idempotencyKey.current = null;
    apply.reset();
  }

  function applySelection() {
    if (!detail?.proposal || selectedCount === 0) return;
    const key = idempotencyKey.current ?? crypto.randomUUID();
    idempotencyKey.current = key;
    apply.mutate({
      key,
      payload: {
        proposalVersion: detail.proposalVersion,
        profileVersion: detail.profileVersion,
        items: detail.proposal.items.map((item) => ({
          proposalItemId: item.proposalItemId,
          selected: selection[item.proposalItemId] ?? (item.supportStatus === "SUPPORTED" && item.evidenceRefs.length > 0),
        })),
      },
    });
  }

  async function refreshAfterConflict() {
    setRefreshingAfterConflict(true);
    setRefreshError(null);
    const refreshed = await detailQuery.refetch();
    if (refreshed.isSuccess) {
      setSelection({});
      idempotencyKey.current = null;
      apply.reset();
      setConflict(null);
      setStale(false);
    } else {
      setRefreshError("Chưa tải được phiên mới. Dữ liệu vẫn được khóa; hãy thử lại.");
    }
    setRefreshingAfterConflict(false);
  }

  if (forceState === "loading" || detailQuery.isPending) return <LoadingState label="Đang tải chi tiết tài liệu" />;
  if (forceState === "error" || !detail) {
    return <ErrorState title="Chưa thể mở tài liệu" description={detailQuery.error instanceof Error ? detailQuery.error.message : "Tài liệu có thể đã bị xóa hoặc kết nối đang gián đoạn."} onRetry={() => void detailQuery.refetch()} />;
  }

  const currentStatus = receipt ? "APPLIED" : detail.status;
  const canParse = currentStatus === "PENDING" || currentStatus === "FAILED";
  const isApplied = currentStatus === "APPLIED";

  return (
    <div>
      <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <Link href="/ho-so/import" className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-primary"><ArrowLeft size={16} aria-hidden="true" /> Danh sách tài liệu</Link>
          <div className="mt-2 flex flex-wrap items-center gap-2"><StatusBadge status={currentStatus} /><span className="text-xs text-muted">Cập nhật {formatDate(detail.updatedAt)}</span></div>
          <h1 className="mt-3 text-balance text-2xl font-bold tracking-[-0.03em] text-ink [overflow-wrap:anywhere] sm:text-3xl">{detail.fileName}</h1>
          <p className="mt-2 text-sm leading-6 text-muted">{formatFileSize(detail.sizeBytes)} · {formatMimeType(detail.mimeType)} · Lần đề xuất {detail.proposalVersion}</p>
        </div>
        {canParse ? (
          <Button onClick={() => parse.mutate()} disabled={parse.isPending}>
            {parse.isPending ? <><LoaderCircle size={17} className="animate-spin" aria-hidden="true" /> Đang phân tích…</> : <><Sparkles size={17} aria-hidden="true" /> {currentStatus === "FAILED" ? "Thử phân tích lại" : "Phân tích tài liệu"}</>}
          </Button>
        ) : null}
      </header>

      <ol aria-label="Tiến trình nhập hồ sơ" className="mt-6 grid gap-2 sm:grid-cols-3">
        {[
          ["1", "Tải tài liệu", true],
          ["2", "Duyệt đề xuất", ["PARSED", "APPLIED"].includes(currentStatus)],
          ["3", "Cập nhật hồ sơ", currentStatus === "APPLIED"],
        ].map(([step, label, complete]) => (
          <li key={String(step)} className={cn("flex items-center gap-3 rounded-xl border p-3 text-sm font-semibold", complete ? "border-[#D7E7DA] bg-[#F5FAF6] text-sage-strong" : "border-border bg-white text-muted")}>
            <span className={cn("grid size-7 place-items-center rounded-full", complete ? "bg-sage text-white" : "bg-background")}>{complete ? <Check size={15} aria-hidden="true" /> : step}</span>{label}
          </li>
        ))}
      </ol>

      <div aria-live="polite" className="mt-4">
        {(parseResult?.aiStatus ?? detail.aiStatus) ? (
          <AiStatusNotice
            status={(parseResult?.aiStatus ?? detail.aiStatus)!}
            questions={parseResult?.clarificationQuestions ?? detail.clarificationQuestions}
            warnings={parseResult?.warnings ?? detail.warnings}
          />
        ) : null}
        {parse.isError ? <AiStatusNotice status="failed" /> : null}
        {stale ? <StaleState busy={refreshingAfterConflict} conflict={conflict} refreshError={refreshError} onRefresh={() => void refreshAfterConflict()} /> : null}
      </div>

      {isApplied ? (
        <Card className="mt-4 border-[#CFE1D3] bg-[#F5FAF6]">
          <CardContent className="flex flex-col items-start gap-4 sm:flex-row sm:items-center">
            <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-white text-sage shadow-sm" aria-hidden="true"><CheckCircle2 size={25} /></span>
            <div className="flex-1"><h2 className="text-base font-bold text-sage-strong">Hồ sơ đã được cập nhật</h2><p className="mt-1 text-sm leading-6 text-sage-strong">{receipt ? `${receipt.createdEntityIds.length} mục đã thêm · phiên hồ sơ ${receipt.profileVersion}.` : "Lựa chọn trước đó đã được áp dụng."} Thử lại sau khi mất kết nối sẽ không tạo dữ liệu trùng.</p></div>
            <Button asChild><Link href="/ho-so">Xem hồ sơ <ArrowRight size={16} aria-hidden="true" /></Link></Button>
          </CardContent>
        </Card>
      ) : null}

      <div className="mt-4 grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
        <Card className="self-start">
          <CardHeader>
            <p className="text-xs font-bold uppercase tracking-[0.12em] text-primary">Bước 2 · Quyền quyết định thuộc về bạn</p>
            <h2 className="mt-1 text-lg font-bold text-ink">Chọn thông tin muốn giữ</h2>
            <p className="mt-2 text-sm leading-6 text-muted">Mỗi đề xuất phải có nguồn kiểm chứng. Mục thiếu minh chứng được khóa để bảo vệ tính chính xác.</p>
          </CardHeader>
          <CardContent>
            {currentStatus === "PROCESSING" ? <LoadingState label="AI đang đối chiếu tài liệu" /> : null}
            {canParse ? (
              <div className="flex min-h-64 flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-background/40 p-8 text-center">
                <Sparkles size={26} className="text-violet" aria-hidden="true" />
                <h3 className="mt-4 text-base font-bold text-ink">Tài liệu chưa được phân tích</h3>
                <p className="mt-2 max-w-sm text-sm leading-6 text-muted">Bắt đầu phân tích để nhận đề xuất. Thao tác này không thay đổi hồ sơ.</p>
              </div>
            ) : null}
            {!canParse && currentStatus !== "PROCESSING" && proposalItems.length === 0 ? (
              <div className="rounded-2xl border border-[#F0DFC0] bg-[#FFFAF0] p-5 text-sm leading-6 text-[#80520F]">Không có đề xuất đủ điều kiện để hiển thị. Hồ sơ hiện tại vẫn giữ nguyên.</div>
            ) : null}
            {proposalItems.length > 0 ? (
              <ul className="space-y-3" aria-label="Các thông tin được đề xuất">
                {proposalItems.map((item) => {
                  const disabled = isApplied || item.value === null || item.evidenceRefs.length === 0 || item.supportStatus !== "SUPPORTED";
                  const selected = !disabled && (selection[item.proposalItemId] ?? item.supportStatus === "SUPPORTED");
                  return <ProposalItem key={item.proposalItemId} item={item} selected={selected} disabled={disabled} onChange={(checked) => selectItem(item, checked)} />;
                })}
              </ul>
            ) : null}
          </CardContent>
        </Card>

        <aside className="self-start space-y-4" aria-label="Tóm tắt cập nhật">
          <Card>
            <CardHeader><p className="text-xs font-bold uppercase tracking-[0.12em] text-primary">Bước 3</p><h2 className="mt-1 text-lg font-bold text-ink">Xác nhận cập nhật</h2></CardHeader>
            <CardContent>
              <div className="rounded-xl bg-background p-4"><p className="text-xs text-muted">Đã chọn</p><p className="mt-1 text-2xl font-bold text-ink">{selectedCount}<span className="text-sm font-medium text-muted"> / {proposalItems.length} mục</span></p></div>
              <ul className="mt-4 space-y-2 text-sm leading-6 text-muted">
                <li className="flex gap-2"><CheckCircle2 size={16} className="mt-0.5 shrink-0 text-sage" aria-hidden="true" /> Chỉ mục đã chọn mới được ghi.</li>
                <li className="flex gap-2"><FileSearch size={16} className="mt-0.5 shrink-0 text-sage" aria-hidden="true" /> Mọi dữ kiện đều kèm nguồn.</li>
                <li className="flex gap-2"><ShieldCheck size={16} className="mt-0.5 shrink-0 text-sage" aria-hidden="true" /> Thao tác được bảo vệ khỏi gửi trùng.</li>
              </ul>
              {apply.isError && !stale ? <p role="alert" className="mt-4 rounded-xl bg-danger-soft p-3 text-sm leading-6 text-danger">{apply.error instanceof Error ? apply.error.message : "Chưa thể cập nhật hồ sơ. Hãy thử lại."}</p> : null}
              <Button className="mt-5 w-full" onClick={applySelection} disabled={selectedCount === 0 || apply.isPending || isApplied || stale || refreshingAfterConflict}>
                {apply.isPending ? <><LoaderCircle size={17} className="animate-spin" aria-hidden="true" /> Đang cập nhật…</> : <><CheckCircle2 size={17} aria-hidden="true" /> Cập nhật {selectedCount} mục</>}
              </Button>
              <p className="mt-3 text-center text-sm leading-6 text-muted">Nếu kết nối gián đoạn, bạn có thể thử lại mà không tạo bản sao.</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="flex items-start gap-3">
              <Clock3 size={18} className="mt-0.5 shrink-0 text-primary" aria-hidden="true" />
              <div><h2 className="text-sm font-bold text-ink">Dữ liệu có thể thay đổi</h2><p className="mt-1 text-sm leading-6 text-muted">CareerMate sẽ dừng và yêu cầu tải lại nếu hồ sơ được sửa trong tab khác.</p></div>
            </CardContent>
          </Card>
        </aside>
      </div>
    </div>
  );
}
