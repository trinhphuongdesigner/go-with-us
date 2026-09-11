import { apiRequest } from './client';
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
  jobTitle?: string;
  avatarUrl?: string;
  themeConcept?: ThemeConcept;
  contributionScore?: number;
  attitudeScore?: number;
}

export function listUsers() {
  return apiRequest<User[]>('/users');
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
