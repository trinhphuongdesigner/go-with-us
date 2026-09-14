"use client";

import { useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/features/auth/auth-provider";
import { apiRequest, listAvailableCompaniesLive } from "@/lib/api";
import { Button } from "@/components/ui/button";

export const fieldClass = "min-h-11 w-full rounded-xl border border-border bg-surface px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-primary/30";
export const panelClass = "rounded-2xl border border-border bg-surface p-5 shadow-sm";
export function Field({ label, children }: { label: string; children: ReactNode }) { return <label className="grid gap-2 text-sm font-semibold text-ink">{label}{children}</label>; }
export function Notice({ error }: { error: unknown }) { return error ? <p role="alert" className="rounded-xl border border-danger/30 bg-danger-soft p-3 text-sm text-danger">{error instanceof Error ? error.message : String(error)}</p> : null; }
export function TalentHeader({ title, description }: { title: string; description: string }) { return <header className="space-y-3"><p className="text-xs font-semibold uppercase tracking-[.18em] text-primary">CareerMate · Phát triển bền vững</p><h1 className="text-3xl font-bold text-ink">{title}</h1><p className="max-w-3xl text-sm leading-6 text-muted">{description}</p><nav className="flex flex-wrap gap-2 text-sm"><Link className="rounded-lg border border-border px-3 py-2" href="/danh-gia">Đánh giá</Link><Link className="rounded-lg border border-border px-3 py-2" href="/cong-ty/tieu-chi">Mẫu & chu kỳ</Link><Link className="rounded-lg border border-border px-3 py-2" href="/ho-chieu">Hộ chiếu</Link><Link className="rounded-lg border border-border px-3 py-2" href="/job-requirements">Nhu cầu nhân sự</Link></nav></header>; }
type TalentCompany = { id: string; name: string };

export function useTalentScope() {
  const { session } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const isSuper = session?.user.role === "SUPER_ADMIN";
  const companies = useQuery<TalentCompany[]>({
    queryKey: ["talent-companies", session?.accessToken, isSuper],
    queryFn: () => isSuper
      ? listAvailableCompaniesLive(session!)
      : apiRequest<TalentCompany[]>("/company-memberships/mine", undefined, session?.accessToken),
    enabled: !!session,
  });
  const available = companies.data ?? [];
  // An explicit selection that was revoked must not fall back to a different tenant.
  const requested = searchParams.get("companyId");
  const preferred = requested ?? (!isSuper ? session?.user.companyId ?? "" : "");
  const companyId = !companies.isError && available.some(company => company.id === preferred) ? preferred : "";
  const scope = companyId ? `companyId=${encodeURIComponent(companyId)}` : "";
  const selectCompany = (nextCompanyId: string) => {
    const nextParams = new URLSearchParams(searchParams.toString());
    if (nextCompanyId) nextParams.set("companyId", nextCompanyId);
    else nextParams.delete("companyId");
    const query = nextParams.toString();
    router.replace(query ? `${pathname}?${query}` : pathname);
  };
  const selector = <div className="max-w-md space-y-2"><Field label="Doanh nghiệp đang xem"><select className={fieldClass} value={companyId} disabled={companies.isLoading} onChange={(event) => selectCompany(event.target.value)}><option value="">Chọn doanh nghiệp</option>{available.map((company) => <option key={company.id} value={company.id}>{company.name}</option>)}</select></Field><p className="text-xs text-muted">Lựa chọn này không chuyển công ty chính hoặc quyền xét duyệt của tài khoản.</p><Notice error={companies.error} />{!companies.isLoading && !companies.isError && available.length === 0 && <p role="status" className="text-sm text-muted">Chưa có công ty đang hoạt động mà bạn được truy cập.</p>}</div>;
  return { session, companyId, scope, ready: !!session && !!companyId, selector };
}
export function useTalentQuery<T>(path: string, enabled = true) {
  const { session } = useAuth();
  return useQuery<T>({ queryKey: ["talent", path, session?.accessToken], queryFn: () => apiRequest<T>(path, undefined, session?.accessToken), enabled: !!session && enabled });
}
export function useTalentAction(refresh?: () => unknown) {
  const { session } = useAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [message, setMessage] = useState("");
  async function run<T>(path: string, method: string, body?: unknown): Promise<T | undefined> {
    setBusy(true); setError(null); setMessage("");
    try { const result = await apiRequest<T>(path, { method, ...(body !== undefined ? { body: JSON.stringify(body) } : {}) }, session?.accessToken); await refresh?.(); return result; }
    catch (error) { setError(error); return undefined; }
    finally { setBusy(false); }
  }
  return { run, busy, error, message, setMessage, feedback: <><Notice error={error} />{message && <p role="status" className="rounded-xl bg-primary-subtle p-3 text-sm text-primary-strong">{message}</p>}</> };
}
export function Loading({ loading, error, retry }: { loading: boolean; error: unknown; retry: () => unknown }) { return <>{loading && <p role="status" className="text-sm text-muted">Đang tải dữ liệu…</p>}<Notice error={error} />{!!error && <Button variant="secondary" onClick={() => void retry()}>Tải lại</Button>}</>; }

export type Template = { id: string; familyId: string; version: number; rowVersion: number; companyId: string; name: string; description: string; status: "DRAFT" | "ACTIVE" | "ARCHIVED"; groups: Array<{id: string; name: string; description: string; weight: number; scoreDimension: "CONTRIBUTION" | "ATTITUDE"; passportDimension?: "ATTENDANCE" | "PROACTIVENESS" | "KNOWLEDGE" | "SKILL" | "ACTIVITY_PARTICIPATION" | null; questions: Array<{id: string; text: string; guidance: string; weight: number; maxScore: number}>}> };
export type Cycle = { id: string; name: string; period: string; status: "OPEN" | "CLOSED"; version: number; dueDate: string | null; template: Template };
export type Answer = { questionId: string; score: number; comment: string };
export type Assessment = { id: string; companyId: string; cycleId: string; revieweeId: string; reviewerId: string; revieweeName: string; reviewerName: string; type: string; status: string; version: number; templateSnapshot: Template; answers: Answer[]; mood: string; highlights: string; comment: string; reviewComment: string; totalScore: number | null; contributionScore: number | null; attitudeScore: number | null };
export type Snapshot = { name: string; jobTitle: string | null; content: string; evaluation: string; strengths: string[]; growthAreas: string[]; dimensionScores: Record<string, number>; approvedAt: string; skills: Array<{name: string; rating: number; source: string}>; assessments: Array<{type: string; totalScore: number | null; approvedAt: string | null}>; generationBasis?: { assessmentIds?: string[]; claimEvidenceRefs?: string[]; calculationVersion?: string; narrativeSource?: "AI" | "ADMIN_EDIT" } };
export type Summary = { id: string; ownerUserId: string; ownerName: string; companyId: string; employmentId: string | null; source: string; status: string; version: number; content: string; evaluation: string; dimensionScores: Record<string, number>; strengths: string[]; growthAreas: string[]; generatedAt: string | null; approvedAt: string | null; snapshot: Snapshot };
export const statusLabel: Record<string, string> = {DRAFT:"Bản nháp", ACTIVE:"Đã phát hành", ARCHIVED:"Lưu trữ", OPEN:"Đang mở", CLOSED:"Đã đóng", SUBMITTED:"Chờ duyệt", APPROVED:"Đã duyệt", REJECTED:"Cần chỉnh sửa", SELF:"Tự đánh giá", PEER:"Đánh giá đồng nghiệp", MANAGER:"Đánh giá quản lý"};
