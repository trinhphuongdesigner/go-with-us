import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { Role } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { AuthenticatedUser } from '../auth/jwt.strategy';

const SALT_ROUNDS = 10;

// Never leak passwordHash back to any client.
const PUBLIC_USER_SELECT = {
  id: true,
  email: true,
  name: true,
  role: true,
  companyId: true,
  avatarUrl: true,
  jobTitle: true,
  themeConcept: true,
  contributionScore: true,
  attitudeScore: true,
  createdAt: true,
  updatedAt: true,
} as const;

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * SUPER_ADMIN sees every user; COMPANY_ADMIN sees only their own
   * company's users; EMPLOYEE sees self + same-company peers (read-only —
   * enforced by the controller only exposing this method behind any
   * authenticated role, and mutate methods separately role-checking).
   */
  findAll(caller: AuthenticatedUser) {
    if (caller.role === Role.SUPER_ADMIN) {
      return this.prisma.user.findMany({
        select: PUBLIC_USER_SELECT,
        orderBy: { createdAt: 'desc' },
      });
    }

    if (!caller.companyId) {
      throw new ForbiddenException('No company scope for this account');
    }

    return this.prisma.user.findMany({
      where: { companyId: caller.companyId },
      select: PUBLIC_USER_SELECT,
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string, caller: AuthenticatedUser) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: PUBLIC_USER_SELECT,
    });
    if (!user) {
      throw new NotFoundException(`User ${id} not found`);
    }
    this.assertVisible(user, caller);
    return user;
  }

  /**
   * COMPANY_ADMIN creates EMPLOYEE rows scoped to their own company.
   * SUPER_ADMIN may create any role directly (COMPANY_ADMIN creation is
   * normally done via CompaniesService.create alongside a new Company, but
   * this stays open for flexibility). EMPLOYEE callers cannot create users.
   */
  async create(dto: CreateUserDto, caller: AuthenticatedUser) {
    if (caller.role === Role.EMPLOYEE) {
      throw new ForbiddenException('Employees cannot create users');
    }

    const existing = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (existing) {
      throw new ConflictException(
        `A user with email ${dto.email} already exists`,
      );
    }

    let companyId: string | null = null;
    if (caller.role === Role.COMPANY_ADMIN) {
      if (dto.role !== Role.EMPLOYEE) {
        throw new ForbiddenException(
          'Company admins can only create EMPLOYEE users',
        );
      }
      companyId = caller.companyId;
    } else if (caller.role === Role.SUPER_ADMIN) {
      if (dto.role !== Role.SUPER_ADMIN && !dto.companyId) {
        throw new BadRequestException(
          'companyId is required for COMPANY_ADMIN/EMPLOYEE users',
        );
      }
      companyId =
        dto.role === Role.SUPER_ADMIN ? null : (dto.companyId ?? null);
    }

    const passwordHash = await bcrypt.hash(dto.password, SALT_ROUNDS);
    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        passwordHash,
        name: dto.name,
        role: dto.role,
        companyId,
        jobTitle: dto.jobTitle,
      },
      select: PUBLIC_USER_SELECT,
    });

    return user;
  }

  async update(id: string, dto: UpdateUserDto, caller: AuthenticatedUser) {
    const target = await this.prisma.user.findUnique({
      where: { id },
      select: PUBLIC_USER_SELECT,
    });
    if (!target) {
      throw new NotFoundException(`User ${id} not found`);
    }

    const isSelf = target.id === caller.id;
    const isSameCompanyAdmin =
      caller.role === Role.COMPANY_ADMIN &&
      caller.companyId === target.companyId;
    if (!isSelf && caller.role !== Role.SUPER_ADMIN && !isSameCompanyAdmin) {
      throw new ForbiddenException('Not allowed to update this user');
    }

    return this.prisma.user.update({
      where: { id },
      data: dto,
      select: PUBLIC_USER_SELECT,
    });
  }

  async remove(id: string, caller: AuthenticatedUser) {
    const target = await this.prisma.user.findUnique({ where: { id } });
    if (!target) {
      throw new NotFoundException(`User ${id} not found`);
    }

    const isSameCompanyAdmin =
      caller.role === Role.COMPANY_ADMIN &&
      caller.companyId === target.companyId;
    if (caller.role !== Role.SUPER_ADMIN && !isSameCompanyAdmin) {
      throw new ForbiddenException('Not allowed to delete this user');
    }

    await this.prisma.user.delete({ where: { id } });
    return { id };
  }

  private assertVisible(
    target: { companyId: string | null; id: string },
    caller: AuthenticatedUser,
  ) {
    if (caller.role === Role.SUPER_ADMIN) return;
    if (caller.id === target.id) return;
    if (caller.companyId && caller.companyId === target.companyId) return;
    throw new ForbiddenException('Not allowed to view this user');
  }
}
