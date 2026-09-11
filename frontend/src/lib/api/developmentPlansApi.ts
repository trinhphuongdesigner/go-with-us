import { apiRequest } from './client';

// Mirrors backend/prisma/schema.prisma's GoalStatus enum.
export type GoalStatus = 'NOT_STARTED' | 'IN_PROGRESS' | 'ACHIEVED';

export interface DevelopmentGoal {
  id: string;
  userId: string;
  title: string;
  metric: string | null;
  targetValue: number | null;
  currentValue: number | null;
  status: GoalStatus;
  aiScore: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateGoalPayload {
  title: string;
  metric?: string;
  targetValue?: number;
  currentValue?: number;
  status?: GoalStatus;
}

export interface UpdateGoalPayload {
  title?: string;
  metric?: string;
  targetValue?: number;
  currentValue?: number;
  status?: GoalStatus;
}

export interface DevelopmentPlan {
  id: string;
  userId: string;
  content: string;
  aiGenerated: boolean;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface GeneratePlanPayload {
  instruction?: string;
}

export interface GeneratePlanResult {
  planMd: string;
  summary: string;
}

export interface SavePlanPayload {
  content: string;
  summary?: string;
  aiGenerated?: boolean;
}

// ---- Goals ----

export function listGoals() {
  return apiRequest<DevelopmentGoal[]>('/development-plans/goals');
}

export function createGoal(payload: CreateGoalPayload) {
  return apiRequest<DevelopmentGoal>('/development-plans/goals', {
    method: 'POST',
    body: payload,
  });
}

export function updateGoal(id: string, payload: UpdateGoalPayload) {
  return apiRequest<DevelopmentGoal>(`/development-plans/goals/${id}`, {
    method: 'PATCH',
    body: payload,
  });
}

export function deleteGoal(id: string) {
  return apiRequest<{ id: string }>(`/development-plans/goals/${id}`, {
    method: 'DELETE',
  });
}

// ---- Plan: AI skill (proposal only) + explicit persistence ----

export function generatePlan(payload: GeneratePlanPayload) {
  return apiRequest<GeneratePlanResult>('/development-plans/generate', {
    method: 'POST',
    body: payload,
  });
}

export function saveMyPlan(payload: SavePlanPayload) {
  return apiRequest<DevelopmentPlan>('/development-plans/me', {
    method: 'PUT',
    body: payload,
  });
}

export function getMyPlan() {
  return apiRequest<DevelopmentPlan | null>('/development-plans/me');
}
