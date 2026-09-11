import { findDemoAccount, findDemoAccountByToken } from "@/features/auth/demo-accounts";
import type { DashboardSummary, Permission, Session, SessionUser } from "@/lib/types";
import type { components } from "../../../contracts/generated/openapi";

type ContractLoginResponse = components["schemas"]["LoginResponse"];
type ContractMeResponse = components["schemas"]["MeResponse"];
type ContractSessionUser = components["schemas"]["SessionUserRead"];

export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api/v2";
export const DEMO_MODE = process.env.NEXT_PUBLIC_DEMO_MODE === "true";

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }
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

async function request<T>(path: string, init?: RequestInit, token?: string): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      ...init?.headers,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });

  if (!response.ok) {
    let details: unknown;
    try {
      details = await response.json();
    } catch {
      details = undefined;
    }
    throw new ApiError("Yêu cầu không thành công", response.status, details);
  }

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

  const response = await request<ContractLoginResponse>("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
  return { accessToken: response.accessToken, user: normalizeSessionUser(response.user) };
}

export async function logout(accessToken: string): Promise<void> {
  if (DEMO_MODE) return;
  await request<{ message: string }>("/auth/logout", { method: "POST" }, accessToken);
}

export async function getCurrentSession(accessToken: string): Promise<Session> {
  if (DEMO_MODE) {
    const account = findDemoAccountByToken(accessToken);
    if (!account) throw new ApiError("Phiên demo không hợp lệ.", 401);
    return { accessToken, user: account.user };
  }

  const response = await request<ContractMeResponse>("/auth/me", undefined, accessToken);
  return { accessToken, user: normalizeSessionUser(response.user) };
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
