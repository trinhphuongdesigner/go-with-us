import { apiRequest } from './client';
import type { Company } from '@/types';

export interface CreateCompanyPayload {
  name: string;
  industry?: string;
  adminEmail: string;
  adminName: string;
  adminPassword: string;
}

export function listCompanies() {
  return apiRequest<Company[]>('/companies');
}

export function getCompany(id: string) {
  return apiRequest<Company>(`/companies/${id}`);
}

export function createCompany(payload: CreateCompanyPayload) {
  return apiRequest<Company>('/companies', { method: 'POST', body: payload });
}

export function updateCompany(id: string, payload: Partial<Pick<Company, 'name' | 'industry'>>) {
  return apiRequest<Company>(`/companies/${id}`, { method: 'PATCH', body: payload });
}

export function deleteCompany(id: string) {
  return apiRequest<{ id: string }>(`/companies/${id}`, { method: 'DELETE' });
}
