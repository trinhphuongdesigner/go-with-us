import { apiRequest } from './client';

export type CompetencyRequestSourceType = 'CERTIFICATION' | 'AWARD';
export type CompetencyRequestStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export interface CompetencyRequest {
  id: string;
  senderId: string;
  recipientId: string;
  companyId: string;
  sourceType: CompetencyRequestSourceType;
  sourceId: string;
  sourceSnapshot: Record<string, unknown>;
  message: string | null;
  status: CompetencyRequestStatus;
  pointsAwarded: number | null;
  reviewNote: string | null;
  reviewedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

/** Only present on `listReceived` — HR needs to know who sent it. */
export interface CompetencyRequestWithSender extends CompetencyRequest {
  sender: { id: string; name: string; email: string };
}

export interface CreateCompetencyRequestPayload {
  sourceType: CompetencyRequestSourceType;
  sourceId: string;
  employmentId: string;
  recipientUserId: string;
  message?: string;
}

export interface ReviewCompetencyRequestPayload {
  status: 'APPROVED' | 'REJECTED';
  pointsAwarded?: number;
  reviewNote?: string;
}

export function createCompetencyRequest(payload: CreateCompetencyRequestPayload) {
  return apiRequest<CompetencyRequest>('/competency-requests', {
    method: 'POST',
    body: payload,
  });
}

export function listSentCompetencyRequests() {
  return apiRequest<CompetencyRequest[]>('/competency-requests/sent');
}

export function listReceivedCompetencyRequests(status?: CompetencyRequestStatus) {
  const query = status ? `?status=${status}` : '';
  return apiRequest<CompetencyRequestWithSender[]>(`/competency-requests/received${query}`);
}

export function reviewCompetencyRequest(id: string, payload: ReviewCompetencyRequestPayload) {
  return apiRequest<CompetencyRequest>(`/competency-requests/${id}/review`, {
    method: 'PATCH',
    body: payload,
  });
}
