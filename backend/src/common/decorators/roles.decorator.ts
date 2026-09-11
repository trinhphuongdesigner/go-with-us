import { SetMetadata } from '@nestjs/common';
import { Role } from '@prisma/client';

export const ROLES_KEY = 'roles';

/**
 * Marks a route/controller as restricted to one or more Roles. Read by
 * RolesGuard (common/guards/roles.guard.ts). Usage:
 *   @Roles(Role.SUPER_ADMIN)
 *   @UseGuards(JwtAuthGuard, RolesGuard)
 */
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);
