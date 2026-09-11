import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { AdminPermission, Role } from '@prisma/client';
import { assertAdminPermission } from './admin-permissions';
import type { PrismaService } from '../../prisma/prisma.service';
import type { AuthenticatedUser } from '../../modules/auth/jwt.strategy';

/**
 * "Can this caller look at that person's record?" — the same rule
 * ActivityLogsService/UsersService already apply, pulled out because every
 * CareerMate module (profile, assessments, passport) needs it.
 *
 * Self: always. SUPER_ADMIN: anyone. COMPANY_ADMIN: same-company only.
 * EMPLOYEE: nobody but themselves.
 */
export async function assertCanViewUser(
  prisma: PrismaService,
  caller: AuthenticatedUser,
  targetUserId: string,
  what = 'record',
): Promise<void> {
  if (targetUserId === caller.id) return;

  if (caller.role === Role.SUPER_ADMIN) return;

  if (caller.role === Role.COMPANY_ADMIN) {
    assertAdminPermission(caller, AdminPermission.VIEW);
    const target = await prisma.user.findUnique({
      where: { id: targetUserId },
      select: { companyId: true },
    });
    if (!target) {
      throw new NotFoundException(`User ${targetUserId} not found`);
    }
    if (!caller.companyId || caller.companyId !== target.companyId) {
      throw new ForbiddenException(`Not allowed to view this user's ${what}`);
    }
    return;
  }

  throw new ForbiddenException(`Not allowed to view this user's ${what}`);
}

/**
 * Resolves which company a write should land in: SUPER_ADMIN must name one,
 * everyone else is pinned to their own. Mirrors JobRequirementsService.create.
 */
export function resolveCompanyScope(
  caller: AuthenticatedUser,
  explicitCompanyId?: string,
): string {
  if (caller.role === Role.SUPER_ADMIN) {
    if (!explicitCompanyId) {
      throw new ForbiddenException('companyId is required for SUPER_ADMIN');
    }
    return explicitCompanyId;
  }
  if (!caller.companyId) {
    throw new ForbiddenException('No company scope for this account');
  }
  return caller.companyId;
}
