import { apiRequest } from './client';
import type {
  Award,
  Certification,
  EmployeeSkillEntry,
  ProjectExperience,
} from './competencyProfileApi';

export type EmploymentStatus = 'ACTIVE' | 'ENDED';

export interface Employment {
  id: string;
  userId: string;
  companyId: string;
  jobTitle: string;
  level: string | null;
  department: string | null;
  startDate: string;
  endDate: string | null;
  status: EmploymentStatus;
  company: { id: string; name: string };
}

export interface CareerSummary {
  id: string;
  userId: string;
  employmentId: string | null;
  content: string;
  strengths: string[];
  growthAreas: string[];
  aiGenerated: boolean;
  periodStart: string | null;
  periodEnd: string | null;
  createdAt: string;
}

export interface PassportAssessment {
  id: string;
  type: string;
  totalScore: number | null;
  mood: string | null;
  highlights: string | null;
  approvedAt: string | null;
  cycle: { period: string; name: string } | null;
}

export interface PassportPeriod extends Employment {
  projectExperiences: ProjectExperience[];
  assessments: PassportAssessment[];
  summary: CareerSummary | null;
  averageScore: number | null;
}

export interface CareerPassport {
  user: {
    id: string;
    name: string;
    email: string;
    jobTitle: string | null;
    avatarUrl: string | null;
    company: { id: string; name: string } | null;
  };
  periods: PassportPeriod[];
  overallSummary: CareerSummary | null;
  skills: EmployeeSkillEntry[];
  certifications: Certification[];
  awards: Award[];
  share?: { label: string | null; viewCount: number };
}

export interface PassportShare {
  id: string;
  userId: string;
  token: string;
  label: string | null;
  companyId: string | null;
  expiresAt: string | null;
  revokedAt: string | null;
  viewCount: number;
  createdAt: string;
  company?: { id: string; name: string } | null;
}

export interface CareerSummaryProposal {
  content: string;
  strengths: string[];
  growthAreas: string[];
  summary: string;
}

export interface CreateEmploymentPayload {
  userId?: string;
  companyId?: string;
  jobTitle: string;
  level?: string;
  department?: string;
  startDate: string;
  endDate?: string;
}

export interface UpdateEmploymentPayload {
  jobTitle?: string;
  level?: string;
  department?: string;
  startDate?: string;
  endDate?: string;
  status?: EmploymentStatus;
}

const withUser = (userId?: string) =>
  userId ? `?userId=${encodeURIComponent(userId)}` : '';

export function getCareerPassport(userId?: string) {
  return apiRequest<CareerPassport>(`/career-passport${withUser(userId)}`);
}

/** Public, token-only read — used by the /passport/[token] page. */
export function getSharedPassport(token: string) {
  return apiRequest<CareerPassport>(`/passport/${encodeURIComponent(token)}`, {
    skipAuth: true,
  });
}

// --- Employments ------------------------------------------------------------

export function listEmployments(userId?: string) {
  return apiRequest<Employment[]>(
    `/career-passport/employments${withUser(userId)}`,
  );
}

export function createEmployment(payload: CreateEmploymentPayload) {
  return apiRequest<Employment>('/career-passport/employments', {
    method: 'POST',
    body: payload,
  });
}

export function updateEmployment(
  id: string,
  payload: UpdateEmploymentPayload,
) {
  return apiRequest<Employment>(`/career-passport/employments/${id}`, {
    method: 'PATCH',
    body: payload,
  });
}

// --- AI summary -------------------------------------------------------------

export function listCareerSummaries() {
  return apiRequest<CareerSummary[]>('/career-passport/summaries');
}

/** AI proposal — nothing is saved until saveCareerSummary is called. */
export function generateCareerSummary(payload: {
  employmentId?: string;
  userId?: string;
}) {
  return apiRequest<CareerSummaryProposal>(
    '/career-passport/summaries/generate',
    { method: 'POST', body: payload },
  );
}

export function saveCareerSummary(payload: {
  employmentId?: string;
  content: string;
  strengths?: string[];
  growthAreas?: string[];
}) {
  return apiRequest<CareerSummary>('/career-passport/summaries', {
    method: 'POST',
    body: payload,
  });
}

// --- Share links ------------------------------------------------------------

export function listPassportShares() {
  return apiRequest<PassportShare[]>('/career-passport/shares');
}

export function createPassportShare(payload: {
  label?: string;
  companyId?: string;
  expiresAt?: string;
}) {
  return apiRequest<PassportShare>('/career-passport/shares', {
    method: 'POST',
    body: payload,
  });
}

export function revokePassportShare(id: string) {
  return apiRequest<PassportShare>(`/career-passport/shares/${id}/revoke`, {
    method: 'PATCH',
  });
}
