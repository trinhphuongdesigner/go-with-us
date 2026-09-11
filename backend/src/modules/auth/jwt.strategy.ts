import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { AdminPermission, Role } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

export interface JwtPayload {
  sub: string;
  email: string;
  role: Role;
  companyId: string | null;
}

export interface AuthenticatedUser {
  id: string;
  email: string;
  name: string;
  role: Role;
  companyId: string | null;
  adminPermissions: AdminPermission[];
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey:
        configService.get<string>('JWT_SECRET') ?? 'dev-secret-change-me',
    });
  }

  async validate(payload: JwtPayload): Promise<AuthenticatedUser> {
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
    });
    if (!user) {
      throw new UnauthorizedException('User no longer exists');
    }

    // Resolve effective admin permissions from RoleDefinition (dynamic roles)
    // Falls back to legacy user.adminPermissions for COMPANY_ADMIN during transition
    let adminPermissions: AdminPermission[] = [];

    if (user.role === Role.SUPER_ADMIN) {
      adminPermissions = [AdminPermission.FULL];
    } else {
      // For roles with companyId (COMPANY_ADMIN, HR, BOD, EMPLOYEE)
      // SUPER_ADMIN case handled above with companyId: null
      const roleDef = await this.prisma.roleDefinition.findFirst({
        where: { companyId: user.companyId, role: user.role },
      });

      if (roleDef) {
        adminPermissions = roleDef.permissions;
      } else if (user.role === Role.COMPANY_ADMIN) {
        // Fallback to legacy per-user permissions for existing COMPANY_ADMINs
        adminPermissions = user.adminPermissions;
      } else {
        // HR/BOD without RoleDefinition → empty (no permissions until provisioned)
        adminPermissions = [];
      }
    }

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      companyId: user.companyId,
      adminPermissions,
    };
  }
}
