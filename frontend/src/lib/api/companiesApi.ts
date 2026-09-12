import { apiRequest } from './client';
import type { Company, User } from '@/types';

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

export interface CompanyMember {
  id: string;
  userId: string;
  companyId: string;
  createdAt: string;
  user: Pick<User, 'id' | 'name' | 'email' | 'role' | 'jobTitle'>;
}

export function listCompanies() {
  return apiRequest<Company[]>('/companies');
}

/** Companies the current user belongs to — feeds the employee-facing "Công ty" nav. */
export function listMyCompanies() {
  return apiRequest<Company[]>('/companies/mine');
}

export function getCompany(id: string) {
  return apiRequest<Company>(`/companies/${id}`);
}

export function listMembers(companyId: string) {
  return apiRequest<CompanyMember[]>(`/companies/${companyId}/members`);
}

export function addMember(companyId: string, userId: string) {
  return apiRequest<CompanyMember>(`/companies/${companyId}/members`, {
    method: 'POST',
    body: { userId },
  });
}

export function removeMember(companyId: string, userId: string) {
  return apiRequest<{ companyId: string; userId: string }>(
    `/companies/${companyId}/members/${userId}`,
    { method: 'DELETE' },
  );
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
