import type { AdminPermission, Role } from '@/types';

export function isEmployeeRole(role?: Role): boolean {
  return !!role && role !== 'SUPER_ADMIN' && role !== 'COMPANY_ADMIN';
}

export function isSystemAdmin(role?: Role): boolean {
  return role === 'SUPER_ADMIN' || role === 'COMPANY_ADMIN';
}

export function hasAdminPermission(
  permissions: AdminPermission[] | undefined,
  permission: AdminPermission,
): boolean {
  return !!permissions?.some((value) => value === 'FULL' || value === permission);
}
