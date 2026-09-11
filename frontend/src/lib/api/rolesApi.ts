import { apiRequest } from './client';
import type { AdminPermission, Role, RoleDefinition } from '@/types';

export interface UpdateRolePermissionsPayload {
  permissions: AdminPermission[];
}

export function listRoles(companyId?: string) {
  const query = companyId ? `?companyId=${encodeURIComponent(companyId)}` : '';
  return apiRequest<RoleDefinition[]>(`/roles${query}`);
}

export function updateRolePermissions(
  role: Role,
  payload: UpdateRolePermissionsPayload,
  companyId?: string,
) {
  const query = companyId ? `?companyId=${encodeURIComponent(companyId)}` : '';
  return apiRequest<RoleDefinition>(`/roles/${role}${query}`, {
    method: 'PATCH',
    body: payload,
  });
}
