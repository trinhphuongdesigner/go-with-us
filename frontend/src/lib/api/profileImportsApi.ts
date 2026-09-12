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

// --- Rich profile update (Cập nhật hồ sơ năng lực) --------------------------

export interface RichBasicInfo {
  name?: string;
  jobTitle?: string;
  phone?: string;
  summary?: string;
}

export interface RichSkill {
  name: string;
  level?: number;
  note?: string;
}

export interface RichActivity {
  title: string;
  description?: string;
  category?: string;
  date: string;
}

export interface RichGoal {
  title: string;
  description?: string;
  category?: 'WORK' | 'PERSONAL';
  dueDate?: string;
  metric?: string;
}

export interface RichRoadmapTask {
  title: string;
  metric?: string;
}

export interface RichRoadmapMilestone {
  title: string;
  description?: string;
  dueDate?: string;
  tasks: RichRoadmapTask[];
}

export interface RichIdentityCheck {
  detectedSourceName?: string;
  matches?: boolean;
}

export interface RichProfileProposal {
  identityCheck?: RichIdentityCheck;
  basicInfo?: RichBasicInfo;
  skills?: RichSkill[];
  projects?: ParsedProfile['projects'];
  certifications?: ParsedProfile['certifications'];
  awards?: ParsedProfile['awards'];
  activities?: RichActivity[];
  goals?: RichGoal[];
  roadmap?: { milestones: RichRoadmapMilestone[] };
  summary: string;
  dedupNotes?: string;
}

export interface AnalyzeSourcesPayload {
  urls?: string[];
  pastedTexts?: string[];
  // files handled via FormData separately
}

export interface RefinePayload {
  proposal?: RichProfileProposal;
  instruction: string;
}

export interface ApplyRichPayload {
  basicInfo?: RichBasicInfo;
  skills?: RichSkill[];
  projects?: ParsedProfile['projects'];
  certifications?: ParsedProfile['certifications'];
  awards?: ParsedProfile['awards'];
  activities?: RichActivity[];
  goals?: RichGoal[];
  roadmap?: { milestones: RichRoadmapMilestone[] };
}

export interface ApplyRichResult {
  basic: number;
  skills: number;
  projects: number;
  certifications: number;
  awards: number;
  activities: number;
  goals: number;
  roadmapMilestones: number;
}

/** Send sources (urls + texts + files) for AI analysis. Returns proposal only. */
export async function analyzeSources(payload: AnalyzeSourcesPayload, files?: File[]) {
  const form = new FormData();
  if (payload.urls?.length) form.append('urls', JSON.stringify(payload.urls));
  if (payload.pastedTexts?.length) form.append('pastedTexts', JSON.stringify(payload.pastedTexts));
  if (files?.length) {
    files.forEach((f) => form.append('files', f));
  }
  const token = typeof window !== 'undefined' ? localStorage.getItem('gwu_access_token') : null;
  const res = await fetch((process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000/api') + '/profile-imports/analyze', {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    body: form,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || 'Phân tích thất bại');
  }
  return res.json() as Promise<RichProfileProposal>;
}

/** Refine current proposal with user instruction. */
export function refineProposal(payload: RefinePayload) {
  return apiRequest<RichProfileProposal>('/profile-imports/refine', {
    method: 'POST',
    body: payload,
  });
}

/** Explicit save of edited rich proposal. */
export function applyRichUpdates(payload: ApplyRichPayload) {
  return apiRequest<ApplyRichResult>('/profile-imports/apply-rich', {
    method: 'POST',
    body: payload,
  });
}
