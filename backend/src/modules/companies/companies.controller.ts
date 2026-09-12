import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { CompaniesService } from './companies.service';
import { CreateCompanyDto } from './dto/create-company.dto';
import { UpdateCompanyDto } from './dto/update-company.dto';
import { AddCompanyMemberDto } from './dto/company-membership.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/jwt.strategy';

@Controller('companies')
@UseGuards(JwtAuthGuard, RolesGuard)
export class CompaniesController {
  constructor(private readonly companiesService: CompaniesService) {}

  @Get()
  @Roles(Role.SUPER_ADMIN)
  findAll() {
    return this.companiesService.findAll();
  }

  // Registered ahead of ':id' so it isn't shadowed by that param route.
  @Get('me')
  @Roles(Role.COMPANY_ADMIN)
  findOwn(@CurrentUser() user: AuthenticatedUser) {
    return this.companiesService.findOwn(user.companyId!);
  }

  @Patch('me')
  @Roles(Role.COMPANY_ADMIN)
  updateOwn(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateCompanyDto,
  ) {
    return this.companiesService.updateOwn(user.companyId!, dto);
  }

  // Also registered ahead of ':id' — companies the caller belongs to.
  @Get('mine')
  @Roles(Role.HR, Role.BOD, Role.EMPLOYEE)
  listMine(@CurrentUser() user: AuthenticatedUser) {
    return this.companiesService.listMine(user.id);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.companiesService.findOneForCaller(id, user);
  }

  @Get(':id/members')
  @Roles(Role.SUPER_ADMIN, Role.COMPANY_ADMIN)
  listMembers(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    this.assertCanManageMembers(user, id);
    return this.companiesService.listMembers(id);
  }

  @Post(':id/members')
  @Roles(Role.SUPER_ADMIN, Role.COMPANY_ADMIN)
  addMember(
    @Param('id') id: string,
    @Body() dto: AddCompanyMemberDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    this.assertCanManageMembers(user, id);
    return this.companiesService.addMember(id, dto.userId);
  }

  @Delete(':id/members/:userId')
  @Roles(Role.SUPER_ADMIN, Role.COMPANY_ADMIN)
  removeMember(
    @Param('id') id: string,
    @Param('userId') userId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    this.assertCanManageMembers(user, id);
    return this.companiesService.removeMember(id, userId);
  }

  @Post()
  @Roles(Role.SUPER_ADMIN)
  create(@Body() dto: CreateCompanyDto) {
    return this.companiesService.create(dto);
  }

  @Patch(':id')
  @Roles(Role.SUPER_ADMIN)
  update(@Param('id') id: string, @Body() dto: UpdateCompanyDto) {
    return this.companiesService.update(id, dto);
  }

  @Delete(':id')
  @Roles(Role.SUPER_ADMIN)
  remove(@Param('id') id: string) {
    return this.companiesService.remove(id);
  }

  /** Company Admin may only manage members of their own company. */
  private assertCanManageMembers(user: AuthenticatedUser, companyId: string) {
    if (user.role === Role.SUPER_ADMIN) return;
    if (user.role === Role.COMPANY_ADMIN && user.companyId === companyId)
      return;
    throw new ForbiddenException(
      'Not allowed to manage members for this company',
    );
  }
}
