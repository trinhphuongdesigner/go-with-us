import { apiRequest } from './client';

export interface JobRequirement {
  id: string;
  companyId: string;
  createdById: string;
  title: string;
  description: string;
  requiredSkills: string[];
  status: string;
  createdAt: string;
}

export interface CreateJobRequirementPayload {
  title: string;
  description: string;
  requiredSkills: string[];
  companyId?: string;
}

export interface UpdateJobRequirementPayload {
  title?: string;
  description?: string;
  requiredSkills?: string[];
  status?: string;
}

export interface CandidateMatch {
  userId: string;
  name: string;
  jobTitle: string | null;
  matchScore: number;
  rationale: string;
}

export interface MatchResult {
  matches: CandidateMatch[];
  summary: string;
}

export function listJobRequirements(companyId?: string) {
  const query = companyId ? `?companyId=${encodeURIComponent(companyId)}` : '';
  return apiRequest<JobRequirement[]>(`/job-requirements${query}`);
}

export function createJobRequirement(payload: CreateJobRequirementPayload) {
  return apiRequest<JobRequirement>('/job-requirements', { method: 'POST', body: payload });
}

export function updateJobRequirement(id: string, payload: UpdateJobRequirementPayload) {
  return apiRequest<JobRequirement>(`/job-requirements/${id}`, { method: 'PATCH', body: payload });
}

export function deleteJobRequirement(id: string) {
  return apiRequest<{ id: string }>(`/job-requirements/${id}`, { method: 'DELETE' });
}

export function matchJobRequirement(id: string) {
  return apiRequest<MatchResult>(`/job-requirements/${id}/match`, { method: 'POST' });
}
