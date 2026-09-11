import { apiRequest } from './client';

export type ImportSourceType = 'CV_TEXT' | 'CV_FILE' | 'LINKEDIN_URL';
export type ImportStatus = 'PENDING' | 'PARSED' | 'APPLIED' | 'FAILED';

export interface ParsedProfile {
  profile: { name?: string; jobTitle?: string; summary?: string };
  skills: { name: string; level: number }[];
  certifications: {
    name: string;
    issuer?: string;
    type?: string;
    score?: string;
    issuedAt?: string;
  }[];
  projects: {
    name: string;
    role: string;
    domain?: string;
    techStack?: string[];
    contribution?: string;
    startDate?: string;
    endDate?: string;
  }[];
  awards: {
    title: string;
    category?: string;
    issuer?: string;
    description?: string;
    awardedAt?: string;
  }[];
  summary: string;
}

export interface ProfileImport {
  id: string;
  userId: string;
  sourceType: ImportSourceType;
  sourceName: string | null;
  rawText: string;
  parsedData: ParsedProfile | null;
  status: ImportStatus;
  error: string | null;
  appliedAt: string | null;
  createdAt: string;
}

export interface CreateProfileImportPayload {
  sourceType: ImportSourceType;
  sourceName?: string;
  rawText: string;
}

/** What the user decided to keep from the AI proposal. */
export interface ApplyProfileImportPayload {
  jobTitle?: string;
  skills?: { name: string; level?: number }[];
  certifications?: ParsedProfile['certifications'];
  projects?: ParsedProfile['projects'];
  awards?: ParsedProfile['awards'];
}

export interface ApplyResult {
  import: ProfileImport;
  applied: {
    skills: number;
    certifications: number;
    projects: number;
    awards: number;
  };
}

export function listProfileImports() {
  return apiRequest<ProfileImport[]>('/profile-imports');
}

export function getProfileImport(id: string) {
  return apiRequest<ProfileImport>(`/profile-imports/${id}`);
}

export function createProfileImport(payload: CreateProfileImportPayload) {
  return apiRequest<ProfileImport>('/profile-imports', {
    method: 'POST',
    body: payload,
  });
}

/** AI proposal step — writes nothing to the profile. */
export function parseProfileImport(id: string) {
  return apiRequest<ProfileImport>(`/profile-imports/${id}/parse`, {
    method: 'POST',
  });
}

/** Explicit save step — persists only what the user kept. */
export function applyProfileImport(
  id: string,
  payload: ApplyProfileImportPayload,
) {
  return apiRequest<ApplyResult>(`/profile-imports/${id}/apply`, {
    method: 'POST',
    body: payload,
  });
}

export function deleteProfileImport(id: string) {
  return apiRequest<{ id: string }>(`/profile-imports/${id}`, {
    method: 'DELETE',
  });
}
