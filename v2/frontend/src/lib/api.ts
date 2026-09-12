import { findDemoAccount, findDemoAccountByToken } from "@/features/auth/demo-accounts";
import {
  applyDemoProfileImport,
  createDemoProfileImport,
  getDemoProfileImport,
  listDemoProfileImports,
  parseDemoProfileImport,
} from "@/lib/profile-import-demo";
import type { DashboardSummary, Permission, Session, SessionUser } from "@/lib/types";
import type { components } from "../../../contracts/generated/openapi";

type ContractLoginResponse = components["schemas"]["LoginResponse"];
type ContractMeResponse = components["schemas"]["MeResponse"];
type ContractSessionUser = components["schemas"]["SessionUserRead"];
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

export class ProfileConflictError extends ApiError<ProfileConflict> {
  constructor(details: ProfileConflict) {
    super(details.detail, 409, details);
    this.name = "ProfileConflictError";
  }
}

function isProfileConflict(value: unknown): value is ProfileConflict {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Record<string, unknown>;
  return typeof candidate.detail === "string"
    && (candidate.currentProfileVersion === undefined || candidate.currentProfileVersion === null || typeof candidate.currentProfileVersion === "number")
    && (candidate.currentProposalVersion === undefined || candidate.currentProposalVersion === null || typeof candidate.currentProposalVersion === "number");
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
