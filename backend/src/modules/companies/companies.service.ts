import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { AdminPermission, Role } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateCompanyDto } from './dto/create-company.dto';
import { UpdateCompanyDto } from './dto/update-company.dto';

const SALT_ROUNDS = 10;

@Injectable()
export class CompaniesService {
  constructor(private readonly prisma: PrismaService) {}

  findAll() {
    return this.prisma.company.findMany({ orderBy: { createdAt: 'desc' } });
  }

  async findOne(id: string) {
    const company = await this.prisma.company.findUnique({ where: { id } });
    if (!company) {
      throw new NotFoundException(`Company ${id} not found`);
    }
    return company;
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

    return this.prisma.company.create({
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
