import type { components } from "../../../contracts/generated/openapi";

export type UserRole = components["schemas"]["Role"];

export function isEmployeeRole(role: UserRole) {
  return role === "BOD" || role === "HR" || role === "EMPLOYEE";
}

export const roleLabels: Record<UserRole, string> = {
  SUPER_ADMIN: "Quản trị hệ thống",
  COMPANY_ADMIN: "Quản trị công ty",
  BOD: "Ban giám đốc",
  HR: "Nhân sự",
  EMPLOYEE: "Nhân viên",
};

export type Permission =
  | "dashboard:read"
  | "profile:self"
  | "roadmap:self"
  | "assessment:self"
  | "company:read"
  | "people:read"
  | "people:write"
  | "company:manage"
  | "assessment:review"
  | "passport:approve"
  | "platform:manage"
  | "roles:manage";

export interface SessionUser {
  id: string;
  name: string;
  email: string;
  title: string;
  companyId: string | null;
  companyName: string;
  role: UserRole;
  permissions: Permission[];
  initials: string;
}

export interface Session {
  accessToken: string;
  user: SessionUser;
}

export interface DashboardSummary {
  greeting: string;
  profileCompletion: number;
  activeGoals: number;
  completedMilestones: number;
  totalMilestones: number;
  nextAssessment: string;
  skillFocus: Array<{ name: string; level: number; target: number }>;
  nextMilestone: {
    title: string;
    period: string;
    progress: number;
  } | null;
}
