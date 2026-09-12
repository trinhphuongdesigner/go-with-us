import { apiRequest, ApiError, getStoredToken } from './client';

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
  evidenceUrl: string | null;
  date: string;
  createdAt: string;
}

export interface CreateActivityLogPayload {
  title: string;
  description?: string;
  category?: string;
  evidenceUrl?: string;
  date: string;
}

export interface UpdateActivityLogPayload {
  title?: string;
  description?: string;
  category?: string;
  evidenceUrl?: string;
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

/** Upload evidence file for an activity log entry (image/PDF/Office). Returns { url: string } */
export async function uploadActivityEvidence(file: File): Promise<{ url: string }> {
  const form = new FormData();
  form.append('evidence', file);
  const token = getStoredToken();
  const res = await fetch((process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000/api') + '/activity-logs/evidence', {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    body: form,
  });
  const payload = await res.json().catch(() => null);
  if (!res.ok) {
    const message =
      payload && typeof payload === 'object' && 'message' in payload
        ? String((payload as { message: unknown }).message)
        : 'Tải minh chứng thất bại';
    throw new ApiError(res.status, message, payload);
  }
  return payload;
}
