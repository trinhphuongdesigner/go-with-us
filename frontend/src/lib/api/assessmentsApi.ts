import { apiRequest } from './client';

export type TemplateStatus = 'DRAFT' | 'ACTIVE' | 'ARCHIVED';
export type CycleStatus = 'OPEN' | 'CLOSED';
export type AssessmentType = 'SELF' | 'PEER' | 'MANAGER';
export type AssessmentStatus = 'DRAFT' | 'SUBMITTED' | 'APPROVED' | 'REJECTED';

export interface AssessmentQuestion {
  id: string;
  groupId: string;
  text: string;
  guidance: string | null;
  weight: number;
  maxScore: number;
  order: number;
}

export interface AssessmentGroup {
  id: string;
  templateId: string;
  name: string;
  description: string | null;
  weight: number;
  order: number;
  questions: AssessmentQuestion[];
}

export interface AssessmentTemplate {
  id: string;
  companyId: string;
  name: string;
  description: string | null;
  status: TemplateStatus;
  version: number;
  createdAt: string;
  groups: AssessmentGroup[];
}

export interface AssessmentCycle {
  id: string;
  companyId: string;
  templateId: string;
  name: string;
  period: string;
  status: CycleStatus;
  dueDate: string | null;
  template?: { id: string; name: string };
  _count?: { assessments: number };
}

export interface ActiveCycle extends AssessmentCycle {
  template: AssessmentTemplate & { id: string; name: string };
}

export interface AssessmentAnswer {
  id: string;
  assessmentId: string;
  questionId: string;
  score: number;
  comment: string | null;
}

export interface AssessmentListItem {
  id: string;
  type: AssessmentType;
  status: AssessmentStatus;
  mood: string | null;
  highlights: string | null;
  comment: string | null;
  totalScore: number | null;
  submittedAt: string | null;
  approvedAt: string | null;
  createdAt: string;
  reviewee: { id: string; name: string; jobTitle: string | null };
  reviewer: { id: string; name: string };
  cycle: { id: string; name: string; period: string } | null;
  _count?: { answers: number };
}

export interface AssessmentDetail extends AssessmentListItem {
  templateId: string;
  revieweeId: string;
  reviewerId: string;
  approvedBy: { id: string; name: string } | null;
  template: AssessmentTemplate;
  answers: AssessmentAnswer[];
}

// --- Payloads ---------------------------------------------------------------

export interface QuestionPayload {
  text: string;
  guidance?: string;
  weight?: number;
  maxScore?: number;
}

export interface GroupPayload {
  name: string;
  description?: string;
  weight?: number;
  questions: QuestionPayload[];
}

export interface CreateTemplatePayload {
  name: string;
  description?: string;
  companyId?: string;
  groups: GroupPayload[];
}

export interface UpdateTemplatePayload {
  name?: string;
  description?: string;
  status?: TemplateStatus;
  groups?: GroupPayload[];
}

export interface CreateCyclePayload {
  name: string;
  templateId: string;
  period: string;
  dueDate?: string;
  companyId?: string;
}

export interface AnswerPayload {
  questionId: string;
  score: number;
  comment?: string;
}

export interface CreateAssessmentPayload {
  cycleId?: string;
  revieweeId?: string;
  type: AssessmentType;
  mood?: string;
  highlights?: string;
  comment?: string;
  answers?: AnswerPayload[];
}

export interface UpdateAssessmentPayload {
  mood?: string;
  highlights?: string;
  comment?: string;
  answers?: AnswerPayload[];
}

// --- Templates --------------------------------------------------------------

export function listTemplates(companyId?: string) {
  const query = companyId ? `?companyId=${encodeURIComponent(companyId)}` : '';
  return apiRequest<AssessmentTemplate[]>(`/assessments/templates${query}`);
}

export function getTemplate(id: string) {
  return apiRequest<AssessmentTemplate>(`/assessments/templates/${id}`);
}

export function createTemplate(payload: CreateTemplatePayload) {
  return apiRequest<AssessmentTemplate>('/assessments/templates', {
    method: 'POST',
    body: payload,
  });
}

export function updateTemplate(id: string, payload: UpdateTemplatePayload) {
  return apiRequest<AssessmentTemplate>(`/assessments/templates/${id}`, {
    method: 'PATCH',
    body: payload,
  });
}

export function deleteTemplate(id: string) {
  return apiRequest<{ id: string; archived: boolean }>(
    `/assessments/templates/${id}`,
    { method: 'DELETE' },
  );
}

// --- Cycles -----------------------------------------------------------------

export function listCycles(companyId?: string) {
  const query = companyId ? `?companyId=${encodeURIComponent(companyId)}` : '';
  return apiRequest<AssessmentCycle[]>(`/assessments/cycles${query}`);
}

export function getActiveCycle() {
  return apiRequest<ActiveCycle | null>('/assessments/cycles/active');
}

export function createCycle(payload: CreateCyclePayload) {
  return apiRequest<AssessmentCycle>('/assessments/cycles', {
    method: 'POST',
    body: payload,
  });
}

export function updateCycle(
  id: string,
  payload: { name?: string; status?: CycleStatus; dueDate?: string },
) {
  return apiRequest<AssessmentCycle>(`/assessments/cycles/${id}`, {
    method: 'PATCH',
    body: payload,
  });
}

// --- Assessments ------------------------------------------------------------

export function listAssessments(
  scope: 'mine' | 'received' = 'received',
  userId?: string,
) {
  const params = new URLSearchParams({ scope });
  if (userId) params.set('userId', userId);
  return apiRequest<AssessmentListItem[]>(`/assessments?${params.toString()}`);
}

export function listPendingApproval() {
  return apiRequest<AssessmentListItem[]>('/assessments/pending-approval');
}

export function getAssessment(id: string) {
  return apiRequest<AssessmentDetail>(`/assessments/${id}`);
}

export function createAssessment(payload: CreateAssessmentPayload) {
  return apiRequest<AssessmentDetail>('/assessments', {
    method: 'POST',
    body: payload,
  });
}

export function updateAssessment(id: string, payload: UpdateAssessmentPayload) {
  return apiRequest<AssessmentDetail>(`/assessments/${id}`, {
    method: 'PATCH',
    body: payload,
  });
}

export function submitAssessment(id: string, payload: UpdateAssessmentPayload) {
  return apiRequest<AssessmentDetail>(`/assessments/${id}/submit`, {
    method: 'POST',
    body: payload,
  });
}

export function approveAssessment(id: string) {
  return apiRequest<AssessmentDetail>(`/assessments/${id}/approve`, {
    method: 'POST',
  });
}

export function rejectAssessment(id: string, comment?: string) {
  return apiRequest<AssessmentDetail>(`/assessments/${id}/reject`, {
    method: 'POST',
    body: { comment },
  });
}
