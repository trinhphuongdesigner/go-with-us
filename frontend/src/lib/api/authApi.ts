import { apiRequest } from './client';
import type { AuthResponse, User } from '@/types';

export function login(email: string, password: string) {
  return apiRequest<AuthResponse>('/auth/login', {
    method: 'POST',
    body: { email, password },
    skipAuth: true,
  });
}

export function register(email: string, password: string, name: string) {
  return apiRequest<AuthResponse>('/auth/register', {
    method: 'POST',
    body: { email, password, name },
    skipAuth: true,
  });
}

export function me() {
  return apiRequest<User>('/auth/me');
}
