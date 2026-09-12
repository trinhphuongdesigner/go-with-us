import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { randomUUID } from 'node:crypto';
import { Role } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { StorageService } from '../../storage/storage.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { AuthenticatedUser } from '../auth/jwt.strategy';
import {
  canManageRole,
  getManageableRoles,
} from '../../common/access/role-hierarchy';

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
  phone: true,
  dateOfBirth: true,
  idNumber: true,
  gender: true,
  onboardDate: true,
  emergencyContactName: true,
  emergencyContactPhone: true,
  createdAt: true,
  updatedAt: true,
} as const;

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
  ) {}

  /**
   * SUPER_ADMIN sees every user. EMPLOYEE sees the full same-company
   * roster, read-only (used for the assessment colleague picker etc — not
   * an account-management view, so it's not scoped by the hierarchy below).
   * COMPANY_ADMIN/BOD/HR see only the same-company users they're allowed to
   * manage (see role-hierarchy.ts) — this list doubles as the roster for
   * their user-management UI, so it should never show a peer or superior.
   */
  findAll(
    caller: AuthenticatedUser,
    filter: { role?: Role; companyId?: string } = {},
  ) {
    if (caller.role === Role.SUPER_ADMIN) {
      return this.prisma.user.findMany({
        where: {
          ...(filter.role ? { role: filter.role } : {}),
          ...(filter.companyId ? { companyId: filter.companyId } : {}),
        },
        select: PUBLIC_USER_SELECT,
        orderBy: { createdAt: 'desc' },
      });
    }

    if (!caller.companyId) {
      throw new ForbiddenException('No company scope for this account');
    }

    if (caller.role === Role.EMPLOYEE) {
      return this.prisma.user.findMany({
        where: {
          companyId: caller.companyId,
          ...(filter.role ? { role: filter.role } : {}),
        },
        select: PUBLIC_USER_SELECT,
        orderBy: { createdAt: 'desc' },
      });
    }

    return this.prisma.user.findMany({
      where: {
        companyId: caller.companyId,
        role: {
          in: filter.role
            ? getManageableRoles(caller.role).filter((r) => r === filter.role)
            : getManageableRoles(caller.role),
        },
      },
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
   * COMPANY_ADMIN/BOD/HR create users scoped to their own company, limited
   * to roles strictly below their own in the hierarchy (role-hierarchy.ts)
   * — e.g. COMPANY_ADMIN can create BOD/HR/EMPLOYEE, HR can only create
   * EMPLOYEE. SUPER_ADMIN may create any role directly (COMPANY_ADMIN
   * creation is normally done via CompaniesService.create alongside a new
   * Company, but this stays open for flexibility). EMPLOYEE callers cannot
   * create users.
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
    if (caller.role === Role.SUPER_ADMIN) {
      if (dto.role !== Role.SUPER_ADMIN && !dto.companyId) {
        throw new BadRequestException(
          'companyId is required for COMPANY_ADMIN/BOD/HR/EMPLOYEE users',
        );
      }
      companyId =
        dto.role === Role.SUPER_ADMIN ? null : (dto.companyId ?? null);
    } else {
      if (!canManageRole(caller.role, dto.role)) {
        throw new ForbiddenException(
          `${caller.role} cannot create a ${dto.role} user`,
        );
      }
      companyId = caller.companyId;
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
    const canManageTarget =
      caller.role !== Role.EMPLOYEE &&
      caller.companyId === target.companyId &&
      canManageRole(caller.role, target.role);
    const isPrivileged = caller.role === Role.SUPER_ADMIN || canManageTarget;
    if (!isSelf && !isPrivileged) {
      throw new ForbiddenException('Not allowed to update this user');
    }

    // Role reassignment: only a privileged (non-self) caller may do it, and
    // only into a role that's also within their manageable tier — so HR
    // can't promote someone to BOD, BOD can't promote to COMPANY_ADMIN.
    if (dto.role !== undefined && dto.role !== target.role) {
      if (!isPrivileged || isSelf) {
        throw new ForbiddenException("Not allowed to change this user's role");
      }
      if (
        caller.role !== Role.SUPER_ADMIN &&
        !canManageRole(caller.role, dto.role)
      ) {
        throw new ForbiddenException(
          `${caller.role} cannot assign the ${dto.role} role`,
        );
      }
    }

    // onboardDate is an HR-controlled milestone, not something an employee
    // reports about themselves — only an admin (super or same-company) may
    // set it, whether or not the target happens to also be themselves.
    if (dto.onboardDate !== undefined && caller.role === Role.EMPLOYEE) {
      throw new ForbiddenException('Only an admin can set onboardDate');
    }

    if (dto.email !== undefined && dto.email !== target.email) {
      const existing = await this.prisma.user.findUnique({
        where: { email: dto.email },
      });
      if (existing) {
        throw new ConflictException(
          `A user with email ${dto.email} already exists`,
        );
      }
    }

    const { dateOfBirth, onboardDate, ...rest } = dto;
    return this.prisma.user.update({
      where: { id },
      data: {
        ...rest,
        dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : undefined,
        onboardDate: onboardDate ? new Date(onboardDate) : undefined,
      },
      select: PUBLIC_USER_SELECT,
    });
  }

  async uploadAvatar(file: Express.Multer.File, caller: AuthenticatedUser) {
    const target = await this.prisma.user.findUnique({
      where: { id: caller.id },
      select: { id: true, avatarUrl: true },
    });
    if (!target) {
      throw new NotFoundException(`User ${caller.id} not found`);
    }

    const extensionByMime: Record<string, string> = {
      'image/jpeg': 'jpg',
      'image/png': 'png',
      'image/webp': 'webp',
    };
    const extension = extensionByMime[file.mimetype];
    if (!extension) {
      throw new BadRequestException('Avatar must be a JPEG, PNG or WebP image');
    }

    const prefix = `careermate/avatars/${caller.id}/`;
    const oldKey = this.storage.keyFromPublicUrl(target.avatarUrl);
    const key = ['careermate', 'avatars', caller.id, `${randomUUID()}.${extension}`];
    const avatarUrl = await this.storage.writePublic(key, file.buffer, file.mimetype);

    try {
      const updated = await this.prisma.user.update({
        where: { id: caller.id },
        data: { avatarUrl },
        select: PUBLIC_USER_SELECT,
      });

      if (oldKey?.startsWith(prefix)) {
        void this.storage.delete(oldKey).catch(() => undefined);
      }
      return updated;
    } catch (error) {
      await this.storage.delete(key.join('/')).catch(() => undefined);
      throw error;
    }
  }

  async remove(id: string, caller: AuthenticatedUser) {
    const target = await this.prisma.user.findUnique({ where: { id } });
    if (!target) {
      throw new NotFoundException(`User ${id} not found`);
    }

    const canManageTarget =
      caller.role !== Role.EMPLOYEE &&
      caller.companyId === target.companyId &&
      canManageRole(caller.role, target.role);
    if (caller.role !== Role.SUPER_ADMIN && !canManageTarget) {
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
