import {
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { AdminPermission, Role } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';

const SALT_ROUNDS = 10;

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const passwordMatches = await bcrypt.compare(
      dto.password,
      user.passwordHash,
    );
    if (!passwordMatches) {
      throw new UnauthorizedException('Invalid credentials');
    }

    return this.buildAuthResponse(user);
  }

  /**
   * Bootstrap-only: creates the very first SUPER_ADMIN. Rejected once any
   * user already exists — every subsequent user is created via
   * CompaniesService (Company + its COMPANY_ADMIN) or UsersService
   * (EMPLOYEE), both of which apply real role/company scoping.
   */
  async register(dto: RegisterDto) {
    const existingUserCount = await this.prisma.user.count();
    if (existingUserCount > 0) {
      throw new ForbiddenException(
        'Bootstrap registration is closed — ask an existing admin to create your account.',
      );
    }

    const passwordHash = await bcrypt.hash(dto.password, SALT_ROUNDS);
    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        passwordHash,
        name: dto.name,
        role: Role.SUPER_ADMIN,
      },
    });

    return this.buildAuthResponse(user);
  }

  async me(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new UnauthorizedException('User no longer exists');
    }
    return this.toPublicUser(user);
  }

  private buildAuthResponse(user: {
    id: string;
    email: string;
    name: string;
    role: Role;
    adminPermissions: AdminPermission[];
    companyId: string | null;
    avatarUrl: string | null;
    jobTitle: string | null;
    themeConcept: string;
  }) {
    const payload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      companyId: user.companyId,
    };
    return {
      accessToken: this.jwtService.sign(payload),
      user: this.toPublicUser(user),
    };
  }

  private toPublicUser(user: {
    id: string;
    email: string;
    name: string;
    role: Role;
    adminPermissions: AdminPermission[];
    companyId: string | null;
    avatarUrl: string | null;
    jobTitle: string | null;
    themeConcept: string;
  }) {
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      companyId: user.companyId,
      avatarUrl: user.avatarUrl,
      jobTitle: user.jobTitle,
      themeConcept: user.themeConcept,
      adminPermissions:
        user.role === Role.SUPER_ADMIN
          ? [AdminPermission.FULL]
          : user.role === Role.COMPANY_ADMIN
            ? user.adminPermissions
            : [],
    };
  }
}
