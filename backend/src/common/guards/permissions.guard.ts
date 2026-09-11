import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AdminPermission } from '@prisma/client';
import type { AuthenticatedUser } from '../../modules/auth/jwt.strategy';
import { hasAdminPermission } from '../access/admin-permissions';
import { ADMIN_PERMISSIONS_KEY } from '../access/permission-metadata';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const permissions = this.reflector.getAllAndOverride<AdminPermission[]>(
      ADMIN_PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!permissions?.length) return true;
    const { user } = context
      .switchToHttp()
      .getRequest<{ user?: AuthenticatedUser }>();
    return (
      !!user &&
      permissions.every((permission) => hasAdminPermission(user, permission))
    );
  }
}
