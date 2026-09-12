import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { AdminPermission, Role } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateCompanyDto } from './dto/create-company.dto';
import { UpdateCompanyDto } from './dto/update-company.dto';
import type { AuthenticatedUser } from '../auth/jwt.strategy';

const SALT_ROUNDS = 10;

@Injectable()
export class CompaniesService {
  constructor(private readonly prisma: PrismaService) {}

  findAll() {
    return this.prisma.company.findMany({ orderBy: { createdAt: 'desc' } });
  }

  /** Companies the caller holds a CompanyMembership for — feeds the employee-facing company picker. */
  listMine(userId: string) {
    return this.prisma.company.findMany({
      where: { companyMemberships: { some: { userId } } },
      orderBy: { name: 'asc' },
    });
  }

  async findOne(id: string) {
    const company = await this.prisma.company.findUnique({ where: { id } });
    if (!company) {
      throw new NotFoundException(`Company ${id} not found`);
    }
    return company;
  }

  /**
   * Same lookup as findOne, but also permits any caller who holds a
   * CompanyMembership for this company — not just SUPER_ADMIN — so the
   * employee-facing nested scope can show the company's name/industry.
   */
  async findOneForCaller(id: string, caller: AuthenticatedUser) {
    if (
      caller.role !== Role.SUPER_ADMIN &&
      !caller.companyMemberships.includes(id)
    ) {
      throw new ForbiddenException('Not a member of this company');
    }
    return this.findOne(id);
  }

  listMembers(companyId: string) {
    return this.prisma.companyMembership.findMany({
      where: { companyId },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
            jobTitle: true,
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  async addMember(companyId: string, userId: string) {
    await this.findOne(companyId);
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException(`User ${userId} not found`);
    }
    return this.prisma.companyMembership.upsert({
      where: { userId_companyId: { userId, companyId } },
      create: { userId, companyId },
      update: {},
    });
  }

  async removeMember(companyId: string, userId: string) {
    await this.prisma.companyMembership.deleteMany({
      where: { companyId, userId },
    });
    return { companyId, userId };
  }

  async create(dto: CreateCompanyDto) {
    const existingAdmin = await this.prisma.user.findUnique({
      where: { email: dto.adminEmail },
    });
    if (existingAdmin) {
      throw new ConflictException(
        `A user with email ${dto.adminEmail} already exists`,
      );
    }

    const passwordHash = await bcrypt.hash(dto.adminPassword, SALT_ROUNDS);

    const company = await this.prisma.company.create({
      data: {
        name: dto.name,
        industry: dto.industry,
        users: {
          create: {
            email: dto.adminEmail,
            name: dto.adminName,
            passwordHash,
            role: Role.COMPANY_ADMIN,
            adminPermissions: [AdminPermission.FULL],
          },
        },
      },
      include: { users: true },
    });

    // Auto-create role definitions for this company
    // SUPER_ADMIN is global (companyId=null), handled at system init
    await this.prisma.roleDefinition.createMany({
      data: [
        {
          companyId: company.id,
          role: Role.COMPANY_ADMIN,
          permissions: [AdminPermission.FULL],
          isHidden: true,
        },
        {
          companyId: company.id,
          role: Role.HR,
          permissions: [
            AdminPermission.VIEW,
            AdminPermission.COLLECT,
            AdminPermission.CROSS_ASSESS,
            AdminPermission.EDIT,
          ],
          isHidden: false,
        },
        {
          companyId: company.id,
          role: Role.BOD,
          permissions: [AdminPermission.VIEW, AdminPermission.APPROVE],
          isHidden: false,
        },
      ],
      skipDuplicates: true,
    });

    return company;
  }

  async update(id: string, dto: UpdateCompanyDto) {
    await this.findOne(id);
    return this.prisma.company.update({ where: { id }, data: dto });
  }

  findOwn(companyId: string) {
    return this.findOne(companyId);
  }

  updateOwn(companyId: string, dto: UpdateCompanyDto) {
    return this.update(companyId, dto);
  }

  async remove(id: string) {
    await this.findOne(id);
    await this.prisma.company.delete({ where: { id } });
    return { id };
  }
}
