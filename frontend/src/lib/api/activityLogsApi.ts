import { apiRequest } from './client';

// Activity Log is a phase-2 feature slice — not yet in the shared
// frontend/src/types/index.ts (see that file's own header comment), so
// this module owns its own ActivityLog shape rather than growing that
// shared file.
export interface ActivityLog {
  id: string;
  userId: string;
  title: string;
  description: string | null;
  category: string | null;
  date: string;
  createdAt: string;
}

export interface CreateActivityLogPayload {
  title: string;
  description?: string;
  category?: string;
  date: string;
}

export interface UpdateActivityLogPayload {
  title?: string;
  description?: string;
  category?: string;
  date?: string;
}

/** Omit userId to get the caller's own log. */
export function listActivityLogs(userId?: string) {
  const query = userId ? `?userId=${encodeURIComponent(userId)}` : '';
  return apiRequest<ActivityLog[]>(`/activity-logs${query}`);
}

export function createActivityLog(payload: CreateActivityLogPayload) {
  return apiRequest<ActivityLog>('/activity-logs', { method: 'POST', body: payload });
}

export function updateActivityLog(id: string, payload: UpdateActivityLogPayload) {
  return apiRequest<ActivityLog>(`/activity-logs/${id}`, { method: 'PATCH', body: payload });
}

export function deleteActivityLog(id: string) {
  return apiRequest<{ id: string }>(`/activity-logs/${id}`, { method: 'DELETE' });
}
