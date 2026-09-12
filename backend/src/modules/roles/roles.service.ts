import { ForbiddenException, Injectable } from '@nestjs/common';
import { AdminPermission, Role } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthenticatedUser } from '../auth/jwt.strategy';
import { resolveCompanyScope } from '../../common/access/user-scope';

const HIDDEN_ROLES: Role[] = [Role.SUPER_ADMIN, Role.COMPANY_ADMIN];

const DEFAULT_PERMISSIONS: Record<'HR' | 'BOD', AdminPermission[]> = {
  HR: [
    AdminPermission.VIEW,
    AdminPermission.COLLECT,
    AdminPermission.CROSS_ASSESS,
    AdminPermission.EDIT,
  ],
  BOD: [AdminPermission.VIEW, AdminPermission.APPROVE],
};

@Injectable()
export class RolesService {
  constructor(private readonly prisma: PrismaService) {}

  async listForCompany(caller: AuthenticatedUser, companyId?: string) {
    const scope = resolveCompanyScope(caller, companyId);
    const defs = await this.prisma.roleDefinition.findMany({
      where: { companyId: scope },
      orderBy: { role: 'asc' },
    });
    // Filter out hidden system roles (SUPER_ADMIN / COMPANY_ADMIN)
    return defs.filter((d) => !HIDDEN_ROLES.includes(d.role));
  }

  async updatePermissions(
    caller: AuthenticatedUser,
    targetRole: Role,
    permissions: AdminPermission[],
    companyId?: string,
  ) {
    if (HIDDEN_ROLES.includes(targetRole)) {
      throw new ForbiddenException('Cannot modify hidden system role');
    }
    const scope = resolveCompanyScope(caller, companyId);

    // Only allow HR or BOD
    if (targetRole !== Role.HR && targetRole !== Role.BOD) {
      throw new ForbiddenException('Only HR and BOD roles are editable');
    }

    const def = await this.prisma.roleDefinition.upsert({
      where: { companyId_role: { companyId: scope, role: targetRole } },
      update: { permissions },
      create: {
        companyId: scope,
        role: targetRole,
        permissions,
        isHidden: false,
      },
    });

    return def;
  }
}
