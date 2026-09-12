import { apiRequest } from './client';

// Mirrors backend/prisma/schema.prisma's GoalStatus/LifeCategory/MilestoneStatus enums.
export type GoalStatus = 'NOT_STARTED' | 'IN_PROGRESS' | 'ACHIEVED';
export type LifeCategory = 'WORK' | 'PERSONAL';
export type MilestoneStatus = 'NOT_STARTED' | 'IN_PROGRESS' | 'DONE';

export interface DevelopmentGoal {
  id: string;
  userId: string;
  title: string;
  description: string | null;
  category: LifeCategory;
  metric: string | null;
  targetValue: number | null;
  currentValue: number | null;
  progress: number;
  dueDate: string | null;
  status: GoalStatus;
  aiScore: number | null;
  aiSuggested: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateGoalPayload {
  title: string;
  description?: string;
  category?: LifeCategory;
  metric?: string;
  targetValue?: number;
  currentValue?: number;
  progress?: number;
  dueDate?: string;
  status?: GoalStatus;
  aiSuggested?: boolean;
}

export interface UpdateGoalPayload {
  title?: string;
  description?: string;
  category?: LifeCategory;
  metric?: string;
  targetValue?: number;
  currentValue?: number;
  progress?: number;
  dueDate?: string;
  status?: GoalStatus;
}

export interface RoadmapDisplaySettings {
  character?: string;
  viewMode?: 'stair' | 'diagram';
  costumeColor?: string;
  reduceMotion?: boolean;
  fontSize?: 'sm' | 'md' | 'lg';
}

export interface DevelopmentPlan {
  id: string;
  userId: string;
  content: string;
  aiGenerated: boolean;
  status: string;
  displaySettings: RoadmapDisplaySettings | null;
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

export interface DevelopmentTask {
  id: string;
  milestoneId: string;
  title: string;
  metric: string | null;
  done: boolean;
  order: number;
}

export interface DevelopmentMilestone {
  id: string;
  roadmapId: string;
  title: string;
  description: string | null;
  dueDate: string | null;
  status: MilestoneStatus;
  order: number;
  tasks: DevelopmentTask[];
}

export interface DevelopmentRoadmap {
  id: string;
  planId: string;
  category: LifeCategory;
  durationWeeks: number | null;
  hoursPerWeek: number | null;
  createdAt: string;
  updatedAt: string;
  milestones: DevelopmentMilestone[];
}

export interface CreateTaskPayload {
  title: string;
  metric?: string;
}

export interface CreateMilestonePayload {
  title: string;
  description?: string;
  dueDate?: string;
  tasks?: CreateTaskPayload[];
}

export interface UpdateMilestonePayload {
  title?: string;
  description?: string;
  dueDate?: string;
  status?: MilestoneStatus;
  category?: LifeCategory;
  order?: number;
}

export interface UpdateTaskPayload {
  title?: string;
  metric?: string;
  done?: boolean;
}

export interface RoadmapMilestonePayload {
  title: string;
  description?: string;
  dueDate?: string;
  tasks: CreateTaskPayload[];
}

export interface SaveRoadmapPayload {
  category?: LifeCategory;
  durationWeeks?: number;
  hoursPerWeek?: number;
  milestones: RoadmapMilestonePayload[];
}

// ---- Goals ----

export function listGoals(category?: LifeCategory) {
  const query = category ? `?category=${category}` : '';
  return apiRequest<DevelopmentGoal[]>(`/development-plans/goals${query}`);
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

// ---- Milestones & tasks ----

export function listRoadmaps(category?: LifeCategory) {
  const query = category ? `?category=${category}` : '';
  return apiRequest<DevelopmentRoadmap[]>(
    `/development-plans/me/roadmaps${query}`,
  );
}

export function createMilestone(payload: CreateMilestonePayload) {
  return apiRequest<DevelopmentMilestone>('/development-plans/me/milestones', {
    method: 'POST',
    body: payload,
  });
}

export function updateMilestone(id: string, payload: UpdateMilestonePayload) {
  return apiRequest<DevelopmentMilestone>(`/development-plans/milestones/${id}`, {
    method: 'PATCH',
    body: payload,
  });
}

export function deleteMilestone(id: string) {
  return apiRequest<{ id: string }>(`/development-plans/milestones/${id}`, {
    method: 'DELETE',
  });
}

export function createTask(milestoneId: string, payload: CreateTaskPayload) {
  return apiRequest<DevelopmentTask>(
    `/development-plans/milestones/${milestoneId}/tasks`,
    { method: 'POST', body: payload },
  );
}

export function updateTask(id: string, payload: UpdateTaskPayload) {
  return apiRequest<DevelopmentTask>(`/development-plans/tasks/${id}`, {
    method: 'PATCH',
    body: payload,
  });
}

export function deleteTask(id: string) {
  return apiRequest<{ id: string }>(`/development-plans/tasks/${id}`, {
    method: 'DELETE',
  });
}

/** Explicit save of a reviewed roadmap proposal — creates a new section. */
export function saveRoadmap(payload: SaveRoadmapPayload) {
  return apiRequest<DevelopmentRoadmap>('/development-plans/me/roadmap', {
    method: 'POST',
    body: payload,
  });
}

/** Persists roadmap UI prefs (character, view mode, costume, etc). */
export function updatePlanSettings(payload: RoadmapDisplaySettings) {
  return apiRequest<DevelopmentPlan>('/development-plans/me/settings', {
    method: 'PATCH',
    body: payload,
  });
}
