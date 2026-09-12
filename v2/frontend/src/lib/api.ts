import { findDemoAccount, findDemoAccountByToken } from "@/features/auth/demo-accounts";
import {
  applyDemoProfileImport,
  createDemoProfileImport,
  getDemoProfileImport,
  listDemoProfileImports,
  parseDemoProfileImport,
} from "@/lib/profile-import-demo";
import type { DashboardSummary, Permission, Session, SessionUser } from "@/lib/types";
import {
  createDemoProfileResource,
  deleteDemoProfileResource,
  getDemoOwnProfile,
  getDemoPerson,
  listDemoPeople,
  replaceDemoEmployeeSkills,
  updateDemoOwnProfile,
  updateDemoProfileResource,
} from "@/lib/profile-demo";
import type { components } from "../../../contracts/generated/openapi";

type ContractLoginResponse = components["schemas"]["LoginResponse"];
type ContractMeResponse = components["schemas"]["MeResponse"];
type ContractSessionUser = components["schemas"]["SessionUserRead"];
type ContractProfileRead = components["schemas"]["ProfileRead"];
type ContractRosterPage = components["schemas"]["RosterPageRead"];
type ContractRosterPerson = components["schemas"]["RosterPersonDetailRead"];
type ContractCompanyOptions = components["schemas"]["CompanyOptionListRead"];
type ContractCompetencyProfile = components["schemas"]["CompetencyProfileRead"];
export type AiStatus = components["schemas"]["AiStatus"];
export type ProfileApplyRead = components["schemas"]["ProfileApplyRead"];
export type ProfileApplyRequest = components["schemas"]["ProfileApplyRequest"];
export type ProfileEvidence = components["schemas"]["ProfileEvidenceRead"];
export type ProfileImportDetail = components["schemas"]["ProfileImportDetailRead"];
export type ProfileImportList = components["schemas"]["ProfileImportList"];
export type ProfileImportParse = components["schemas"]["ProfileImportParseRead"];
export type ProfileImportRead = components["schemas"]["ProfileImportRead"];
export type ProfileImportStatus = components["schemas"]["ProfileImportStatus"];
export type ProfileProposalItem = components["schemas"]["ProfileProposalItemRead"];
export type ProfileConflict = components["schemas"]["ProfileConflictRead"];

export type ProfileSourceType = "SELF" | "ADMIN" | "IMPORT";
export type ProfileTimelineKind = components["schemas"]["ProfileTimelineKind"];
export type ProfileResourceKind = "experiences" | "projects" | "certifications" | "awards";
export type ProfileResourceCreate =
  | components["schemas"]["ExperienceCreate"]
  | components["schemas"]["ProjectCreate"]
  | components["schemas"]["CertificationCreate"]
  | components["schemas"]["AwardCreate"];
export type ProfileResourcePatch =
  | components["schemas"]["ExperiencePatch"]
  | components["schemas"]["ProjectPatch"]
  | components["schemas"]["CertificationPatch"]
  | components["schemas"]["AwardPatch"];
export type ProfileResourceRead =
  | components["schemas"]["ExperienceRead"]
  | components["schemas"]["ProjectRead"]
  | components["schemas"]["CertificationRead"]
  | components["schemas"]["AwardRead"];
export type EmployeeSkillReplace = components["schemas"]["EmployeeSkillReplace"];
export type EmployeeSkillListRead = components["schemas"]["EmployeeSkillListRead"];

export interface CoreProfile {
  id: string;
  name: string;
  jobTitle: string;
  initials: string;
  companyName: string;
  profileVersion: number;
  updatedAt: string;
  skills: Array<{ id: string; skillId?: string; name: string; category?: string | null; level: number; note?: string | null; selfAssessed?: boolean; sourceType: ProfileSourceType }>;
  experiences: Array<{ id: string; title: string; organization: string; employmentId?: string | null; description?: string | null; startDate: string | null; endDate: string | null; sourceType?: ProfileSourceType }>;
  projects: Array<{ id: string; name: string; role: string; employmentId?: string | null; domain?: string | null; description?: string | null; techStack?: string[]; contribution?: string | null; url?: string | null; startDate: string | null; endDate: string | null; sourceType?: ProfileSourceType }>;
  certifications: Array<{ id: string; name: string; issuer: string; type?: string; score?: string | null; credentialUrl?: string | null; issuedAt: string | null; expiresAt?: string | null; sourceType?: ProfileSourceType }>;
  awards: Array<{ id: string; name: string; issuer: string; type?: string; description?: string | null; evidenceUrl?: string | null; awardedAt?: string | null; selfReported?: boolean; sourceType?: ProfileSourceType }>;
  employments: Array<{ id: string; title: string; startDate: string; endDate: string | null }>;
  timeline: Array<{ id: string; kind: ProfileTimelineKind; title: string; subtitle: string; startDate: string; endDate: string | null; sourceType: ProfileSourceType | null }>;
}

export interface ProfileUpdateRequest {
  name: string;
  jobTitle: string | null;
  profileVersion: number;
}

export interface ProfileUpdateConflict {
  detail: string;
  currentProfileVersion: number;
}

export interface PersonSummary {
  id: string;
  name: string;
  jobTitle: string;
  department: string;
  initials: string;
  skillCount: number | null;
  profileVersion: number;
  updatedAt: string;
}

export interface PeopleList { items: PersonSummary[]; total: number; page: number; pageSize: number }
export interface PersonDetail extends CoreProfile { department: string }
export interface CompanyOption { id: string; name: string }
export interface PeopleQuery {
  companyId?: string | null;
  q?: string;
  page?: number;
  pageSize?: number;
}
export interface PeopleCompanyScope { companyId?: string | null; companyName?: string }

function initialsFromName(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .slice(-2)
    .map((part) => Array.from(part)[0] ?? "")
    .join("")
    .toLocaleUpperCase("vi-VN");
}

export function adaptProfileRead(profile: ContractProfileRead): CoreProfile {
  return {
    id: profile.id,
    name: profile.name,
    jobTitle: profile.jobTitle ?? "",
    initials: initialsFromName(profile.name),
    companyName: profile.companyName ?? "Chưa thuộc doanh nghiệp",
    profileVersion: profile.profileVersion,
    updatedAt: profile.updatedAt,
    skills: [],
    experiences: [],
    projects: [],
    certifications: [],
    awards: [],
    employments: [],
    timeline: [],
  };
}

export function adaptCompetencyProfile(
  core: CoreProfile,
  aggregate: ContractCompetencyProfile,
): CoreProfile {
  return {
    ...core,
    id: aggregate.user.id,
    name: aggregate.user.name,
    jobTitle: aggregate.user.jobTitle ?? "",
    initials: initialsFromName(aggregate.user.name),
    profileVersion: aggregate.version,
    skills: aggregate.skills.map((item) => ({
      id: item.id,
      skillId: item.skillId,
      name: item.name,
      category: item.category,
      level: item.rating,
      note: item.note,
      selfAssessed: item.selfAssessed,
      sourceType: item.sourceType,
    })),
    experiences: aggregate.experiences.map((item) => ({
      id: item.id,
      title: item.title,
      organization: item.organization,
      employmentId: item.employmentId,
      description: item.description,
      startDate: item.startDate,
      endDate: item.endDate,
      sourceType: item.sourceType,
    })),
    projects: aggregate.projects.map((item) => ({
      id: item.id,
      name: item.name,
      role: item.role,
      employmentId: item.employmentId,
      domain: item.domain,
      description: item.description,
      techStack: item.techStack,
      contribution: item.contribution,
      url: item.url,
      startDate: item.startDate,
      endDate: item.endDate,
      sourceType: item.sourceType,
    })),
    certifications: aggregate.certifications.map((item) => ({
      id: item.id,
      name: item.name,
      issuer: item.issuer,
      type: item.type,
      score: item.score,
      credentialUrl: item.credentialUrl,
      issuedAt: item.issuedAt,
      expiresAt: item.expiresAt,
      sourceType: item.sourceType,
    })),
    awards: aggregate.awards.map((item) => ({
      id: item.id,
      name: item.name,
      issuer: item.issuer,
      type: item.type,
      description: item.description,
      evidenceUrl: item.evidenceUrl,
      awardedAt: item.awardedAt,
      selfReported: item.selfReported,
      sourceType: item.sourceType,
    })),
    employments: aggregate.employments,
    timeline: aggregate.timeline,
  };
}

function adaptRosterSummary(person: components["schemas"]["RosterPersonRead"]): PersonSummary {
  return {
    id: person.id,
    name: person.name,
    jobTitle: person.jobTitle ?? "Chưa cập nhật chức danh",
    department: "Chưa cập nhật",
    initials: initialsFromName(person.name),
    skillCount: null,
    profileVersion: person.profileVersion,
    updatedAt: person.updatedAt,
  };
}

export function adaptRosterPage(page: ContractRosterPage): PeopleList {
  return { items: page.items.map(adaptRosterSummary), total: page.total, page: page.page, pageSize: page.pageSize };
}

export function adaptRosterPerson(
  person: ContractRosterPerson,
  companyName: string,
): PersonDetail {
  return {
    id: person.id,
    name: person.name,
    jobTitle: person.jobTitle ?? "",
    initials: initialsFromName(person.name),
    companyName,
    department: "Chưa cập nhật",
    profileVersion: person.profileVersion,
    updatedAt: person.updatedAt,
    skills: [],
    experiences: [],
    projects: [],
    certifications: [],
    awards: [],
    employments: [],
    timeline: [],
  };
}

export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api/v2";
export const DEMO_MODE = process.env.NEXT_PUBLIC_DEMO_MODE === "true";

export class ApiError<TDetails = unknown> extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly details?: TDetails,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

function runDemo<T>(operation: () => T): T {
  try {
    return operation();
  } catch (error) {
    if (error && typeof error === "object" && "status" in error) {
      const status = Number(error.status);
      const details = "details" in error ? error.details : undefined;
      throw new ApiError(error instanceof Error ? error.message : "Yêu cầu demo không thành công", status, details);
    }
    throw error;
  }
}

export class ProfileConflictError extends ApiError<ProfileConflict> {
  constructor(details: ProfileConflict) {
    super(details.detail, 409, details);
    this.name = "ProfileConflictError";
  }
}

export class ProfileUpdateConflictError extends ApiError<ProfileUpdateConflict> {
  constructor(details: ProfileUpdateConflict) {
    super(details.detail, 409, details);
    this.name = "ProfileUpdateConflictError";
  }
}

function isProfileConflict(value: unknown): value is ProfileConflict {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Record<string, unknown>;
  return typeof candidate.detail === "string"
    && (candidate.currentProfileVersion === undefined || candidate.currentProfileVersion === null || typeof candidate.currentProfileVersion === "number")
    && (candidate.currentProposalVersion === undefined || candidate.currentProposalVersion === null || typeof candidate.currentProposalVersion === "number");
}

function isProfileUpdateConflict(value: unknown): value is ProfileUpdateConflict {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Record<string, unknown>;
  return typeof candidate.detail === "string" && typeof candidate.currentProfileVersion === "number";
}

const knownPermissions = new Set<Permission>([
  "dashboard:read",
  "profile:self",
  "roadmap:self",
  "assessment:self",
  "company:read",
  "company:manage",
  "people:read",
  "people:write",
  "assessment:review",
  "passport:approve",
  "platform:manage",
]);

function isPermission(value: string): value is Permission {
  return knownPermissions.has(value as Permission);
}

function normalizeSessionUser(user: ContractSessionUser): SessionUser {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    title: user.title,
    companyId: user.companyId,
    companyName: user.companyName,
    role: user.role,
    permissions: user.permissions.filter(isPermission),
    initials: user.initials,
  };
}

export async function apiRequest<T>(path: string, init?: RequestInit, token?: string): Promise<T> {
  const headers = new Headers(init?.headers);
  if (!headers.has("Accept")) headers.set("Accept", "application/json");
  const isFormData = typeof FormData !== "undefined" && init?.body instanceof FormData;
  if (init?.body && !isFormData && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  if (token) headers.set("Authorization", `Bearer ${token}`);

  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    headers,
  });

  if (!response.ok) {
    let details: unknown;
    try {
      details = await response.json();
    } catch {
      details = undefined;
    }
    const message = typeof details === "object" && details && "detail" in details && typeof details.detail === "string"
      ? details.detail
      : "Yêu cầu không thành công";
    throw new ApiError(message, response.status, details);
  }

  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

export async function login(email: string, password: string): Promise<Session> {
  if (DEMO_MODE) {
    const account = findDemoAccount(email, password);
    if (!account) {
      throw new ApiError("Email hoặc mật khẩu chưa đúng. Hãy kiểm tra và thử lại.", 401);
    }
    return {
      accessToken: `demo-token-${account.id}`,
      user: account.user,
    };
  }

  const response = await apiRequest<ContractLoginResponse>("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
  return { accessToken: response.accessToken, user: normalizeSessionUser(response.user) };
}

export async function logout(accessToken: string): Promise<void> {
  if (DEMO_MODE) return;
  await apiRequest<{ message: string }>("/auth/logout", { method: "POST" }, accessToken);
}

export async function getCurrentSession(accessToken: string): Promise<Session> {
  if (DEMO_MODE) {
    const account = findDemoAccountByToken(accessToken);
    if (!account) throw new ApiError("Phiên demo không hợp lệ.", 401);
    return { accessToken, user: account.user };
  }

  const response = await apiRequest<ContractMeResponse>("/auth/me", undefined, accessToken);
  return { accessToken, user: normalizeSessionUser(response.user) };
}

export async function listProfileImports(session: Session, page = 1, pageSize = 20): Promise<ProfileImportList> {
  if (DEMO_MODE) return listDemoProfileImports(session.user.id, page, pageSize);
  return apiRequest<ProfileImportList>(`/profile-imports?page=${page}&pageSize=${pageSize}`, undefined, session.accessToken);
}

export async function createProfileImport(session: Session, file: File): Promise<ProfileImportRead> {
  if (DEMO_MODE) return createDemoProfileImport(session.user.id, file);
  const body = new FormData();
  body.set("file", file);
  return apiRequest<ProfileImportRead>("/profile-imports", { method: "POST", body }, session.accessToken);
}

export async function getProfileImport(session: Session, importId: string): Promise<ProfileImportDetail> {
  if (DEMO_MODE) {
    try {
      return getDemoProfileImport(session.user.id, importId);
    } catch (error) {
      throw new ApiError(error instanceof Error ? error.message : "Không tìm thấy bản nhập hồ sơ", 404);
    }
  }
  return apiRequest<ProfileImportDetail>(`/profile-imports/${encodeURIComponent(importId)}`, undefined, session.accessToken);
}

export async function parseProfileImport(session: Session, importId: string): Promise<ProfileImportParse> {
  if (DEMO_MODE) return parseDemoProfileImport(session.user.id, importId);
  return apiRequest<ProfileImportParse>(
    `/profile-imports/${encodeURIComponent(importId)}/parse`,
    { method: "POST" },
    session.accessToken,
  );
}

export async function applyProfileImport(
  session: Session,
  importId: string,
  payload: ProfileApplyRequest,
  idempotencyKey: string,
): Promise<ProfileApplyRead> {
  if (DEMO_MODE) return applyDemoProfileImport(session.user.id, importId, payload, idempotencyKey);
  try {
    return await apiRequest<ProfileApplyRead>(
      `/profile-imports/${encodeURIComponent(importId)}/apply`,
      {
        method: "POST",
        headers: { "Idempotency-Key": idempotencyKey },
        body: JSON.stringify(payload),
      },
      session.accessToken,
    );
  } catch (error) {
    if (error instanceof ApiError && error.status === 409 && isProfileConflict(error.details)) {
      throw new ProfileConflictError(error.details);
    }
    throw error;
  }
}

export async function getOwnProfile(session: Session): Promise<CoreProfile> {
  if (DEMO_MODE) return getDemoOwnProfile(session);
  const [profile, aggregate] = await Promise.all([
    apiRequest<ContractProfileRead>("/profile/me", undefined, session.accessToken),
    apiRequest<ContractCompetencyProfile>("/competency-profile", undefined, session.accessToken),
  ]);
  return adaptCompetencyProfile(adaptProfileRead(profile), aggregate);
}

export async function createProfileResource(
  session: Session,
  kind: ProfileResourceKind,
  payload: ProfileResourceCreate,
): Promise<ProfileResourceRead> {
  if (DEMO_MODE) return runDemo(() => createDemoProfileResource(session, kind, payload));
  return apiRequest<ProfileResourceRead>(
    `/competency-profile/${kind}`,
    { method: "POST", body: JSON.stringify(payload) },
    session.accessToken,
  );
}

export async function updateProfileResource(
  session: Session,
  kind: ProfileResourceKind,
  resourceId: string,
  payload: ProfileResourcePatch,
): Promise<ProfileResourceRead> {
  if (DEMO_MODE) return runDemo(() => updateDemoProfileResource(session, kind, resourceId, payload));
  return apiRequest<ProfileResourceRead>(
    `/competency-profile/${kind}/${encodeURIComponent(resourceId)}`,
    { method: "PATCH", body: JSON.stringify(payload) },
    session.accessToken,
  );
}

export async function deleteProfileResource(
  session: Session,
  kind: ProfileResourceKind,
  resourceId: string,
  profileVersion: number,
): Promise<void> {
  if (DEMO_MODE) return runDemo(() => deleteDemoProfileResource(session, kind, resourceId, profileVersion));
  await apiRequest<void>(
    `/competency-profile/${kind}/${encodeURIComponent(resourceId)}`,
    { method: "DELETE", body: JSON.stringify({ profileVersion }) },
    session.accessToken,
  );
}

export async function replaceEmployeeSkills(
  session: Session,
  userId: string,
  payload: EmployeeSkillReplace,
): Promise<EmployeeSkillListRead> {
  if (DEMO_MODE) return runDemo(() => replaceDemoEmployeeSkills(session, userId, payload));
  return apiRequest<EmployeeSkillListRead>(
    `/skills-competency/users/${encodeURIComponent(userId)}/skills`,
    { method: "PUT", body: JSON.stringify(payload) },
    session.accessToken,
  );
}

export async function updateOwnProfile(session: Session, request: ProfileUpdateRequest): Promise<CoreProfile> {
  if (DEMO_MODE) {
    try {
      return updateDemoOwnProfile(session, request);
    } catch (error) {
      if (error && typeof error === "object" && "status" in error && error.status === 409 && "details" in error && isProfileUpdateConflict(error.details)) {
        throw new ProfileUpdateConflictError(error.details);
      }
      throw error;
    }
  }
  try {
    const response = await apiRequest<ContractProfileRead>("/profile/me", {
      method: "PATCH",
      body: JSON.stringify(request),
    }, session.accessToken);
    return adaptProfileRead(response);
  } catch (error) {
    if (error instanceof ApiError && error.status === 409 && isProfileUpdateConflict(error.details)) {
      throw new ProfileUpdateConflictError(error.details);
    }
    throw error;
  }
}

function assertPeopleRead(session: Session) {
  if (!session.user.permissions.includes("people:read")) {
    throw new ApiError("Bạn không có quyền xem danh sách nhân sự.", 403);
  }
}

function resolvePeopleCompanyId(session: Session, requestedCompanyId?: string | null) {
  const companyId = requestedCompanyId ?? session.user.companyId;
  if (!companyId) {
    throw new ApiError("Hãy chọn doanh nghiệp trước khi xem danh sách nhân sự.", 400);
  }
  return companyId;
}

export async function listAvailableCompaniesLive(session: Session): Promise<CompanyOption[]> {
  const response = await apiRequest<ContractCompanyOptions>(
    "/companies/options",
    undefined,
    session.accessToken,
  );
  return response.items;
}

export async function listAvailableCompanies(session: Session): Promise<CompanyOption[]> {
  if (!session.user.permissions.includes("platform:manage")) {
    throw new ApiError("Bạn không có quyền chọn doanh nghiệp.", 403);
  }
  if (DEMO_MODE) {
    return [{ id: "00000000-0000-5000-8000-000000000101", name: "Acme Việt Nam" }];
  }
  return listAvailableCompaniesLive(session);
}

export async function listPeopleLive(session: Session, query: PeopleQuery = {}): Promise<PeopleList> {
  const params = new URLSearchParams({ companyId: resolvePeopleCompanyId(session, query.companyId) });
  const normalizedQuery = query.q?.trim();
  if (normalizedQuery) params.set("q", normalizedQuery);
  params.set("page", String(query.page ?? 1));
  params.set("pageSize", String(query.pageSize ?? 20));
  return adaptRosterPage(
    await apiRequest<ContractRosterPage>(`/people?${params.toString()}`, undefined, session.accessToken),
  );
}

export async function listPeople(session: Session, query: PeopleQuery = {}): Promise<PeopleList> {
  assertPeopleRead(session);
  if (DEMO_MODE) return listDemoPeople(session, query);
  return listPeopleLive(session, query);
}

export async function getPersonLive(
  session: Session,
  employeeId: string,
  scope: PeopleCompanyScope = {},
): Promise<PersonDetail> {
  const companyId = resolvePeopleCompanyId(session, scope.companyId);
  const response = await apiRequest<ContractRosterPerson>(
    `/people/${encodeURIComponent(employeeId)}?companyId=${encodeURIComponent(companyId)}`,
    undefined,
    session.accessToken,
  );
  return adaptRosterPerson(response, scope.companyName ?? session.user.companyName);
}

export async function getPerson(
  session: Session,
  employeeId: string,
  scope: PeopleCompanyScope = {},
): Promise<PersonDetail> {
  assertPeopleRead(session);
  if (DEMO_MODE) {
    try {
      return getDemoPerson(session, employeeId, scope);
    } catch (error) {
      throw new ApiError(error instanceof Error ? error.message : "Không tìm thấy nhân sự", 404);
    }
  }
  return getPersonLive(session, employeeId, scope);
}

export async function getDashboardSummary(session: Session): Promise<DashboardSummary> {
  if (DEMO_MODE) {
    return {
      greeting: `Chào buổi sáng, ${session.user.name.split(" ").at(-1)}`,
      profileCompletion: session.user.role === "EMPLOYEE" ? 84 : 92,
      activeGoals: session.user.role === "EMPLOYEE" ? 3 : 8,
      completedMilestones: 2,
      totalMilestones: 6,
      nextAssessment: "18 tháng 9, 2026",
      skillFocus: [
        { name: "Giao tiếp & phản hồi", level: 62, target: 80 },
        { name: "Tư duy sản phẩm", level: 74, target: 85 },
        { name: "Dẫn dắt nhóm", level: 48, target: 70 },
      ],
      nextMilestone: {
        title: "Giao tiếp & phản hồi",
        period: "Tuần 3–5",
        progress: 42,
      },
    };
  }

  throw new ApiError("Dữ liệu tổng quan đang được kết nối với backend v2.", 501);
}
