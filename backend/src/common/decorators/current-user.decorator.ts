import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';
import type { AuthenticatedUser } from '../../modules/auth/jwt.strategy';

interface RequestWithUser extends Request {
  user: AuthenticatedUser;
}

/**
 * Pulls the JwtStrategy-attached user off the request. Only meaningful
 * behind JwtAuthGuard.
 */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthenticatedUser => {
    const request = ctx.switchToHttp().getRequest<RequestWithUser>();
    return request.user;
  },
);
