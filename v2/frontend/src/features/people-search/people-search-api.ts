import { z } from "zod";
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
