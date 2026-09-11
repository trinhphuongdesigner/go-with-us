import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role } from '@prisma/client';
import type { Request } from 'express';
import { ROLES_KEY } from '../decorators/roles.decorator';
import type { AuthenticatedUser } from '../../modules/auth/jwt.strategy';

interface RequestWithUser extends Request {
  user?: AuthenticatedUser;
}

/**
 * Reads the @Roles(...) metadata set on a handler/controller and compares
 * it against req.user.role (attached by JwtAuthGuard's JwtStrategy). Must
 * run after JwtAuthGuard — e.g. @UseGuards(JwtAuthGuard, RolesGuard).
 * No metadata set = open to any authenticated user.
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<Role[] | undefined>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest<RequestWithUser>();
    const user = request.user;
    return !!user && requiredRoles.includes(user.role);
  }
}
