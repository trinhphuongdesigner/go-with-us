import { ApiError, apiRequest, getStoredToken } from './client';
import type { Role, ThemeConcept, User } from '@/types';

export interface CreateUserPayload {
  email: string;
  password: string;
  name: string;
  role: Role;
  companyId?: string;
  jobTitle?: string;
}

export interface UpdateUserPayload {
  name?: string;
  email?: string;
  jobTitle?: string;
  themeConcept?: ThemeConcept;
  contributionScore?: number;
  attitudeScore?: number;
  phone?: string;
  dateOfBirth?: string;
  idNumber?: string;
  gender?: string;
  /** Admin-only — UsersService rejects this field from an EMPLOYEE caller. */
  onboardDate?: string;
  emergencyContactName?: string;
  emergencyContactPhone?: string;
}

export function listUsers(filter?: { role?: Role; companyId?: string }) {
  const params = new URLSearchParams();
  if (filter?.role) params.set('role', filter.role);
  if (filter?.companyId) params.set('companyId', filter.companyId);
  const query = params.toString();
  return apiRequest<User[]>(`/users${query ? `?${query}` : ''}`);
}

export function getUser(id: string) {
  return apiRequest<User>(`/users/${id}`);
}

export function createUser(payload: CreateUserPayload) {
  return apiRequest<User>('/users', { method: 'POST', body: payload });
}

export function updateUser(id: string, payload: UpdateUserPayload) {
  return apiRequest<User>(`/users/${id}`, { method: 'PATCH', body: payload });
}

export function deleteUser(id: string) {
  return apiRequest<{ id: string }>(`/users/${id}`, { method: 'DELETE' });
}

/** Upload avatar image for the current user. Returns updated User with new avatarUrl. */
export async function uploadAvatar(file: File): Promise<User> {
  const form = new FormData();
  form.append('avatar', file);
  const token = getStoredToken();
  const res = await fetch((process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000/api') + '/users/me/avatar', {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    body: form,
  });
  const payload = await res.json().catch(() => null);
  if (!res.ok) {
    const message =
      payload && typeof payload === 'object' && 'message' in payload
        ? String((payload as { message: unknown }).message)
        : 'Tải ảnh đại diện thất bại';
    throw new ApiError(res.status, message, payload);
  }
  return payload as User;
}
