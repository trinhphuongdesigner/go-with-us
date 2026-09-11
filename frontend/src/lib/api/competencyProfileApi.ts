import { apiRequest } from './client';

export type CertificationType = 'DEGREE' | 'LANGUAGE' | 'PROFESSIONAL' | 'OTHER';
export type LifeCategory = 'WORK' | 'PERSONAL';

export interface Certification {
  id: string;
  userId: string;
  name: string;
  issuer: string | null;
  type: CertificationType;
  score: string | null;
  issuedAt: string | null;
  expiresAt: string | null;
  credentialUrl: string | null;
}

export interface ProjectExperience {
  id: string;
  userId: string;
  companyId: string | null;
  employmentId: string | null;
  name: string;
  role: string;
  domain: string | null;
  techStack: string[];
  contribution: string | null;
  startDate: string;
  endDate: string | null;
}

export interface Award {
  id: string;
  userId: string;
  title: string;
  category: LifeCategory;
  issuer: string | null;
  description: string | null;
  evidenceUrl: string | null;
  awardedAt: string | null;
  selfReported: boolean;
}

export interface EmployeeSkillEntry {
  id: string;
  level: number;
  selfAssessed: boolean;
  note: string | null;
  skill: { id: string; name: string; category: string | null };
}

export interface EmploymentEntry {
  id: string;
  jobTitle: string;
  level: string | null;
  department: string | null;
  startDate: string;
  endDate: string | null;
  status: 'ACTIVE' | 'ENDED';
  company: { id: string; name: string };
}

export type TimelineKind =
  | 'EMPLOYMENT'
  | 'PROJECT'
  | 'CERTIFICATION'
  | 'AWARD'
  | 'ACTIVITY';

export interface TimelineEntry {
  id: string;
  kind: TimelineKind;
  title: string;
  subtitle: string | null;
  date: string;
  endDate: string | null;
  meta: Record<string, unknown>;
}

export interface CompetencyProfile {
  user: {
    id: string;
    name: string;
    email: string;
    role: string;
    jobTitle: string | null;
    avatarUrl: string | null;
    companyId: string | null;
    company: { id: string; name: string } | null;
  };
  skills: EmployeeSkillEntry[];
  certifications: Certification[];
  projects: ProjectExperience[];
  awards: Award[];
  employments: EmploymentEntry[];
  timeline: TimelineEntry[];
}

export interface CertificationPayload {
  name: string;
  issuer?: string;
  type?: CertificationType;
  score?: string;
  issuedAt?: string;
  expiresAt?: string;
  credentialUrl?: string;
}

export interface ProjectExperiencePayload {
  name: string;
  role: string;
  domain?: string;
  techStack?: string[];
  contribution?: string;
  startDate: string;
  endDate?: string;
  employmentId?: string;
}

export interface AwardPayload {
  title: string;
  category?: LifeCategory;
  issuer?: string;
  description?: string;
  evidenceUrl?: string;
  awardedAt?: string;
}

const withUser = (userId?: string) =>
  userId ? `?userId=${encodeURIComponent(userId)}` : '';

export function getCompetencyProfile(userId?: string) {
  return apiRequest<CompetencyProfile>(`/competency-profile${withUser(userId)}`);
}

// --- Certifications ---------------------------------------------------------

export function listCertifications(userId?: string) {
  return apiRequest<Certification[]>(
    `/competency-profile/certifications${withUser(userId)}`,
  );
}

export function createCertification(payload: CertificationPayload) {
  return apiRequest<Certification>('/competency-profile/certifications', {
    method: 'POST',
    body: payload,
  });
}

export function updateCertification(
  id: string,
  payload: Partial<CertificationPayload>,
) {
  return apiRequest<Certification>(`/competency-profile/certifications/${id}`, {
    method: 'PATCH',
    body: payload,
  });
}

export function deleteCertification(id: string) {
  return apiRequest<{ id: string }>(`/competency-profile/certifications/${id}`, {
    method: 'DELETE',
  });
}

// --- Projects ---------------------------------------------------------------

export function listProjectExperiences(userId?: string) {
  return apiRequest<ProjectExperience[]>(
    `/competency-profile/projects${withUser(userId)}`,
  );
}

export function createProjectExperience(payload: ProjectExperiencePayload) {
  return apiRequest<ProjectExperience>('/competency-profile/projects', {
    method: 'POST',
    body: payload,
  });
}

export function updateProjectExperience(
  id: string,
  payload: Partial<ProjectExperiencePayload>,
) {
  return apiRequest<ProjectExperience>(`/competency-profile/projects/${id}`, {
    method: 'PATCH',
    body: payload,
  });
}

export function deleteProjectExperience(id: string) {
  return apiRequest<{ id: string }>(`/competency-profile/projects/${id}`, {
    method: 'DELETE',
  });
}

// --- Awards -----------------------------------------------------------------

export function listAwards(userId?: string) {
  return apiRequest<Award[]>(`/competency-profile/awards${withUser(userId)}`);
}

export function createAward(payload: AwardPayload) {
  return apiRequest<Award>('/competency-profile/awards', {
    method: 'POST',
    body: payload,
  });
}

export function updateAward(id: string, payload: Partial<AwardPayload>) {
  return apiRequest<Award>(`/competency-profile/awards/${id}`, {
    method: 'PATCH',
    body: payload,
  });
}

export function deleteAward(id: string) {
  return apiRequest<{ id: string }>(`/competency-profile/awards/${id}`, {
    method: 'DELETE',
  });
}
