import type { components } from "../../../contracts/generated/openapi";

export type UserRole = components["schemas"]["Role"];

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
  | "platform:manage";

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
