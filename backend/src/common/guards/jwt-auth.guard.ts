import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/** Requires a valid JWT (see modules/auth/jwt.strategy.ts). */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {}
