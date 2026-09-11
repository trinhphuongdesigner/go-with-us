import { apiRequest } from './client';
import type { Company } from '@/types';

export interface CreateCompanyPayload {
  name: string;
  industry?: string;
  adminEmail: string;
  adminName: string;
  adminPassword: string;
}

export interface UpdateCompanyPayload {
  name?: string;
  industry?: string;
}

export function listCompanies() {
  return apiRequest<Company[]>('/companies');
}

export function getCompany(id: string) {
  return apiRequest<Company>(`/companies/${id}`);
}

/** Company Admin's own company — scoped server-side from the JWT, no id needed. */
export function getMyCompany() {
  return apiRequest<Company>('/companies/me');
}

export function updateMyCompany(payload: UpdateCompanyPayload) {
  return apiRequest<Company>('/companies/me', { method: 'PATCH', body: payload });
}

export function createCompany(payload: CreateCompanyPayload) {
  return apiRequest<Company>('/companies', { method: 'POST', body: payload });
}

export function updateCompany(id: string, payload: UpdateCompanyPayload) {
  return apiRequest<Company>(`/companies/${id}`, { method: 'PATCH', body: payload });
}

export function deleteCompany(id: string) {
  return apiRequest<{ id: string }>(`/companies/${id}`, { method: 'DELETE' });
}
