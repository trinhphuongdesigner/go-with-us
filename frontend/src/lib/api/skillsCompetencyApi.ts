// Types live alongside this module rather than growing frontend/src/types
// (see that file's own header comment) — this is a phase-2 feature slice.
import { apiRequest } from './client';

export interface Skill {
  id: string;
  name: string;
  category: string | null;
}

export interface EmployeeSkill {
  id: string;
  userId: string;
  skillId: string;
  skill: Skill;
  level: number;
  selfAssessed: boolean;
  note: string | null;
  updatedAt: string;
}

export interface UpsertSkillPayload {
  name: string;
  category?: string;
}

export interface EmployeeSkillInput {
  skillId: string;
  level: number;
  note?: string;
}

export interface InsightProfile {
  id: string;
  name: string;
  jobTitle: string | null;
  contributionScore: number | null;
  attitudeScore: number | null;
}

export interface CompetencyInsight {
  profile: InsightProfile;
  skills: EmployeeSkill[];
  goalStatusCounts: Record<string, number>;
  activityCount: number;
  assessmentsReceivedCount: number;
}

export function listSkills() {
  return apiRequest<Skill[]>('/skills-competency/skills');
}

export function upsertSkill(payload: UpsertSkillPayload) {
  return apiRequest<Skill>('/skills-competency/skills', {
    method: 'POST',
    body: payload,
  });
}

export function listUserSkills(userId: string) {
  return apiRequest<EmployeeSkill[]>(`/skills-competency/users/${userId}`);
}

export function bulkUpsertOwnSkills(userId: string, skills: EmployeeSkillInput[]) {
  return apiRequest<EmployeeSkill[]>(`/skills-competency/users/${userId}/skills`, {
    method: 'PUT',
    body: { skills },
  });
}

export function getInsight(userId: string) {
  return apiRequest<CompetencyInsight>(`/skills-competency/insight/${userId}`);
}
