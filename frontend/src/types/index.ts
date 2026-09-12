// Mirrors backend/prisma/schema.prisma enums/shapes for the resources this
// foundation pass actually wires up (Auth/Companies/Users/AiSettings).
// Phase-2 feature slices should add their own types alongside their own
// *Api.ts module rather than growing this file into a shared bottleneck.

export type Role = 'SUPER_ADMIN' | 'COMPANY_ADMIN' | 'BOD' | 'HR' | 'EMPLOYEE';

export type AdminPermission = 'VIEW' | 'COLLECT' | 'CROSS_ASSESS' | 'APPROVE' | 'EDIT' | 'FULL' | 'MANAGE_ROLES';

export interface RoleDefinition {
  id: string;
  companyId: string | null;
  role: Role;
  permissions: AdminPermission[];
  isHidden: boolean;
  createdAt: string;
  updatedAt: string;
}

export type ThemeConcept = 'DEFAULT' | 'ANIME' | 'FILM' | 'GATHER_TOWN';

export type AiProvider = 'ANTHROPIC' | 'OPENAI' | 'GEMINI';

export interface User {
  id: string;
  email: string;
  name: string;
  role: Role;
  companyId: string | null;
  companyName?: string | null;
  avatarUrl: string | null;
  jobTitle: string | null;
  themeConcept: ThemeConcept;
  contributionScore?: number | null;
  attitudeScore?: number | null;
  phone?: string | null;
  dateOfBirth?: string | null;
  idNumber?: string | null;
  gender?: string | null;
  onboardDate?: string | null;
  emergencyContactName?: string | null;
  emergencyContactPhone?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface Company {
  id: string;
  name: string;
  industry: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AiSetting {
  provider: AiProvider;
  hasKey: boolean;
  baseUrl: string | null;
  model: string | null;
}

export interface AuthResponse {
  accessToken: string;
  user: User;
}
