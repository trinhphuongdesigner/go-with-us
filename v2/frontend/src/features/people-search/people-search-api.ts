import { z } from "zod";
import { findDemoAccountByToken } from "@/features/auth/demo-accounts";
import { getDemoPerson, listDemoPeople } from "@/lib/profile-demo";
import { canonicalCandidateSchema } from "./canonical-search-schema";
import { searchInterpretationSchema } from "./search-interpretation-schema";

const skillConstraintSchema = z.object({
  phrase: z.string().min(1),
  required: z.boolean(),
}).strict();

const scoreFactorSchema = z.object({
  code: z.enum(["EXPERIENCE", "TITLE_TEXT_SIGNAL", "DATA_FRESHNESS"]),
  label: z.string(),
  weight: z.number().positive(),
  contribution: z.number().nonnegative(),
}).strict();

const candidateEvidenceSchema = z.object({
  type: z.enum(["user", "employment"]),
  user_id: z.string().nullable(),
  employment_id: z.string().nullable(),
  job_title: z.string().nullable(),
  title: z.string().nullable(),
  status: z.string().nullable(),
  start_date: z.string().nullable(),
  end_date: z.string().nullable(),
}).strict();

const candidateSchema = z.object({
  user_id: z.string().uuid(),
  name: z.string(),
  title: z.string().nullable(),
  company_id: z.string().uuid(),
  score: z.number().min(0).max(100),
  score_version: z.literal("people-search-v1"),
  factors: z.array(scoreFactorSchema),
  evidence: z.array(candidateEvidenceSchema),
}).strict().superRefine((candidate, context) => {
  const sum = candidate.factors.reduce((total, factor) => total + factor.contribution, 0);
  if (Math.abs(sum - candidate.score) > 1e-9) context.addIssue({ code: "custom", message: "score must equal factor contribution sum" });
});

export const peopleSearchResponseSchema = z.object({
  status: z.enum(["ok", "empty", "needs_clarification", "insufficient_evidence", "provider_failure"]),
  plan: z.object({
    raw_query: z.string(),
    required_skills: z.array(skillConstraintSchema),
    preferred_skills: z.array(skillConstraintSchema),
    min_experience_years: z.number().min(0).max(60).nullable(),
    availability: z.enum(["AVAILABLE", "AVAILABLE_SOON"]).nullable(),
    needs_clarification: z.boolean(),
    clarification_reason: z.string().nullable(),
    interpretation: searchInterpretationSchema.nullish(),
  }).strict(),
  candidates: z.array(z.discriminatedUnion("score_version", [candidateSchema, canonicalCandidateSchema])),
  unsupported_reasons: z.array(z.string()),
  explanation: z.string().nullable(),
  explanation_source: z.enum(["ai", "deterministic_fallback"]).nullable(),
}).strict();

export type PeopleSearchResponse = z.infer<typeof peopleSearchResponseSchema>;
export type PeopleSearchCandidate = PeopleSearchResponse["candidates"][number];
export type LegacyPeopleSearchCandidate = Extract<PeopleSearchCandidate, { score_version: "people-search-v1" }>;

const ragEvidenceSchema = z.object({
  source_type: z.enum(["profile", "skill", "experience", "project"]),
  source_id: z.string().uuid(),
  label: z.string().min(1),
  excerpt: z.string().min(1),
  verified: z.boolean(),
}).strict();

const ragCandidateSchema = z.object({
  user_id: z.string().uuid(),
  name: z.string().min(1),
  title: z.string().nullable(),
  company_id: z.string().uuid(),
  matched_terms: z.array(z.string()),
  reason: z.string().min(1),
  evidence: z.array(ragEvidenceSchema).min(1),
}).strict();

export const ragSearchResponseSchema = z.object({
  status: z.enum(["ok", "empty"]),
  answer: z.string().min(1),
  candidates: z.array(ragCandidateSchema),
  retrieval_mode: z.literal("STRUCTURED_PROFILE_RAG"),
  answer_source: z.enum(["ai", "deterministic_fallback"]),
  warnings: z.array(z.string()),
}).strict();

export type RagSearchResponse = z.infer<typeof ragSearchResponseSchema>;
export type RagSearchCandidate = RagSearchResponse["candidates"][number];

const demoStopWords = new Set(["ai", "co", "cua", "cho", "duoc", "kinh", "nghiem", "la", "mot", "nhan", "nguoi", "phu", "hop", "tim", "trong", "toi", "va", "voi"]);

function normalizedTerms(value: string): string[] {
  const normalized = value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("vi-VN");
  return [...new Set(normalized.match(/[a-z0-9+#.]{2,}/g)?.filter((term) => !demoStopWords.has(term)) ?? [])].slice(0, 30);
}

function demoUuid(sequence: number): string {
  return `00000000-0000-5000-8000-${String(sequence).padStart(12, "0")}`;
}

function demoRagSearch(query: string, accessToken: string): RagSearchResponse | undefined {
  const account = findDemoAccountByToken(accessToken);
  if (!account) return undefined;
  if (!account.user.permissions.includes("people:read")) {
    throw new PeopleSearchApiError("Phiên đăng nhập không có quyền hỏi đáp nhân sự.", 403);
  }
  if (!account.user.companyId) {
    return { status: "empty", answer: "Vui lòng chọn công ty trước khi hỏi AI tìm nhân sự.", candidates: [], retrieval_mode: "STRUCTURED_PROFILE_RAG", answer_source: "deterministic_fallback", warnings: ["company_required"] };
  }
  const companyId = account.user.companyId;

  const session = { accessToken, user: account.user };
  const terms = normalizedTerms(query);
  const candidates = listDemoPeople(session, { pageSize: 100 }).items.flatMap((person, personIndex) => {
    const profile = getDemoPerson(session, person.id);
    const rawEvidence = [
      ...profile.skills.map((skill) => ({ source_type: "skill" as const, label: `Kỹ năng: ${skill.name}`, excerpt: `${skill.name}, mức độ ${skill.level}/5${skill.note ? `. ${skill.note}` : ""}`, verified: skill.sourceType !== "SELF" })),
      ...profile.experiences.map((experience) => ({ source_type: "experience" as const, label: `Kinh nghiệm: ${experience.title}`, excerpt: `${experience.title} tại ${experience.organization}${experience.description ? `. ${experience.description}` : ""}`, verified: experience.sourceType !== undefined && experience.sourceType !== "SELF" })),
      ...profile.projects.map((project) => ({ source_type: "project" as const, label: `Dự án: ${project.name}`, excerpt: `${project.name}; vai trò ${project.role}${project.domain ? `; lĩnh vực ${project.domain}` : ""}${project.techStack?.length ? `; công nghệ ${project.techStack.join(", ")}` : ""}`, verified: project.sourceType !== undefined && project.sourceType !== "SELF" })),
    ];
    const evidence = rawEvidence.flatMap((item, evidenceIndex) => {
      const haystack = normalizedTerms(`${item.label} ${item.excerpt}`);
      const matches = terms.filter((term) => haystack.includes(term));
      return matches.length ? [{ ...item, source_id: demoUuid(1000 + personIndex * 100 + evidenceIndex), matches }] : [];
    });
    if (!evidence.length) return [];
    const matchedTerms = terms.filter((term) => evidence.some((item) => item.matches.includes(term)));
    return [{
      user_id: demoUuid(200 + personIndex),
      name: profile.name,
      title: profile.jobTitle || null,
      company_id: companyId,
      matched_terms: matchedTerms,
      reason: `Dữ liệu hồ sơ khớp trực tiếp với: ${matchedTerms.join(", ")}.`,
      evidence: evidence.slice(0, 5).map((item) => ({
        source_type: item.source_type,
        source_id: item.source_id,
        label: item.label,
        excerpt: item.excerpt,
        verified: item.verified,
      })),
    }];
  });
  return candidates.length
    ? { status: "ok", answer: `Tìm thấy ${candidates.length} nhân sự có dữ liệu hồ sơ khớp trực tiếp với yêu cầu.`, candidates: candidates.slice(0, 8), retrieval_mode: "STRUCTURED_PROFILE_RAG", answer_source: "deterministic_fallback", warnings: ["demo_data"] }
    : { status: "empty", answer: "Chưa tìm thấy dữ liệu hồ sơ phù hợp với câu hỏi này.", candidates: [], retrieval_mode: "STRUCTURED_PROFILE_RAG", answer_source: "deterministic_fallback", warnings: ["demo_data"] };
}

export interface PeopleSearchFilters {
  query: string;
  requiredSkills: string;
  preferredSkills: string;
  minExperienceYears: string;
  domains: string;
  availability: "" | "AVAILABLE" | "AVAILABLE_SOON";
}

export interface PeopleSearchRequest {
  query: string;
  accessToken: string;
  signal?: AbortSignal;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api/v2";

export class PeopleSearchApiError extends Error {
  constructor(message: string, public readonly status?: number) {
    super(message);
    this.name = "PeopleSearchApiError";
  }
}

export function compileQuery(filters: PeopleSearchFilters): string {
  const parts = [filters.query.trim()];
  if (filters.requiredSkills.trim()) parts.push(`kỹ năng bắt buộc: ${filters.requiredSkills.trim()}`);
  if (filters.preferredSkills.trim()) parts.push(`kỹ năng ưu tiên: ${filters.preferredSkills.trim()}`);
  if (filters.minExperienceYears) parts.push(`kinh nghiệm tối thiểu ${filters.minExperienceYears} năm`);
  if (filters.domains.trim()) parts.push(`domain bắt buộc: ${filters.domains.trim()}`);
  if (filters.availability) parts.push(`trạng thái sẵn sàng: ${filters.availability}`);
  return parts.filter(Boolean).join("; ");
}

export async function searchPeople({ query, accessToken, signal, companyId }: PeopleSearchRequest & { companyId?: string }): Promise<PeopleSearchResponse> {
  let response: Response;
  try {
    response = await fetch(`${API_URL}/people-search/query${companyId ? `?companyId=${encodeURIComponent(companyId)}` : ""}`, {
      method: "POST",
      credentials: "include",
      signal,
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ query }),
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") throw error;
    throw new PeopleSearchApiError("Không thể kết nối dịch vụ tìm kiếm.");
  }

  if (!response.ok) {
    throw new PeopleSearchApiError(
      response.status === 401 || response.status === 403
        ? "Phiên đăng nhập không có quyền tìm kiếm nhân sự."
        : "Dịch vụ tìm kiếm không thể xử lý yêu cầu.",
      response.status,
    );
  }

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    throw new PeopleSearchApiError("Dịch vụ tìm kiếm trả về dữ liệu không hợp lệ.", response.status);
  }
  const parsed = peopleSearchResponseSchema.safeParse(payload);
  if (!parsed.success) throw new PeopleSearchApiError("Dịch vụ tìm kiếm trả về dữ liệu không đúng hợp đồng.", response.status);
  return parsed.data;
}

export async function askPeople({ query, accessToken, signal, companyId }: PeopleSearchRequest & { companyId?: string }): Promise<RagSearchResponse> {
  const demoResult = demoRagSearch(query, accessToken);
  if (demoResult) return ragSearchResponseSchema.parse(demoResult);
  let response: Response;
  try {
    response = await fetch(`${API_URL}/people-search/ask${companyId ? `?companyId=${encodeURIComponent(companyId)}` : ""}`, {
      method: "POST",
      credentials: "include",
      signal,
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ query }),
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") throw error;
    throw new PeopleSearchApiError("Không thể kết nối dịch vụ hỏi đáp nhân sự.");
  }

  if (!response.ok) {
    throw new PeopleSearchApiError(
      response.status === 401 || response.status === 403
        ? "Phiên đăng nhập không có quyền hỏi đáp nhân sự."
        : "Dịch vụ hỏi đáp không thể xử lý yêu cầu.",
      response.status,
    );
  }

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    throw new PeopleSearchApiError("Dịch vụ hỏi đáp trả về dữ liệu không hợp lệ.", response.status);
  }
  const parsed = ragSearchResponseSchema.safeParse(payload);
  if (!parsed.success) throw new PeopleSearchApiError("Dịch vụ hỏi đáp trả về dữ liệu không đúng hợp đồng.", response.status);
  return parsed.data;
}
