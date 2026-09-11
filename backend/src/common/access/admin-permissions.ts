import { ForbiddenException } from '@nestjs/common';
import { AdminPermission, Role } from '@prisma/client';
import type { AuthenticatedUser } from '../../modules/auth/jwt.strategy';

/** Permissions never widen company scope. Employee grants have no effect. */
export function hasAdminPermission(
  caller: AuthenticatedUser,
  permission: AdminPermission,
): boolean {
  if (caller.role === Role.SUPER_ADMIN) return true;
  return (
    caller.role === Role.COMPANY_ADMIN &&
    (caller.adminPermissions?.includes(AdminPermission.FULL) ||
      caller.adminPermissions?.includes(permission)) === true
  );
}

export function assertAdminPermission(
  caller: AuthenticatedUser,
  permission: AdminPermission,
): void {
  if (!hasAdminPermission(caller, permission)) {
    throw new ForbiddenException(`Admin permission ${permission} is required`);
  }
}
