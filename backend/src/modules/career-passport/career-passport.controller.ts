import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AdminPermission, Role } from '@prisma/client';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { CareerPassportService } from './career-passport.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/jwt.strategy';
import {
  CreateEmploymentDto,
  CreatePassportShareDto,
  GenerateCareerSummaryDto,
  RequestOffboardingSummaryDto,
  SaveCareerSummaryDto,
  UpdateEmploymentDto,
  UpdateOffboardingSummaryDto,
} from './dto/career-passport.dto';

/**
 * M4 — the portable career record (docs/careermate-scope.md section 2.3).
 * Employment periods are the backbone: assessments and projects hang off
 * them, so the record survives the person leaving the company.
 *
 * `summaries/generate` is the AI skill (proposal only); `summaries` POST is
 * the explicit save step.
 */
@Controller('career-passport')
@UseGuards(JwtAuthGuard, RolesGuard)
export class CareerPassportController {
  constructor(private readonly service: CareerPassportService) {}

  @Get()
  getPassport(
    @CurrentUser() caller: AuthenticatedUser,
    @Query('userId') userId?: string,
  ) {
    return this.service.getPassport(caller, userId);
  }

  // --- Employments ---------------------------------------------------------

  @Get('employments')
  listEmployments(
    @CurrentUser() caller: AuthenticatedUser,
    @Query('userId') userId?: string,
  ) {
    return this.service.listEmployments(caller, userId);
  }

  @Post('employments')
  createEmployment(
    @Body() dto: CreateEmploymentDto,
    @CurrentUser() caller: AuthenticatedUser,
  ) {
    return this.service.createEmployment(dto, caller);
  }

  @Patch('employments/:id')
  updateEmployment(
    @Param('id') id: string,
    @Body() dto: UpdateEmploymentDto,
    @CurrentUser() caller: AuthenticatedUser,
  ) {
    return this.service.updateEmployment(id, dto, caller);
  }

  // --- AI career summary ---------------------------------------------------

  @Get('summaries')
  listSummaries(@CurrentUser() caller: AuthenticatedUser) {
    return this.service.listSummaries(caller);
  }

  @Post('summaries/generate')
  generateSummary(
    @Body() dto: GenerateCareerSummaryDto,
    @CurrentUser() caller: AuthenticatedUser,
  ) {
    return this.service.generateSummary(dto, caller);
  }

  @Post('summaries')
  saveSummary(
    @Body() dto: SaveCareerSummaryDto,
    @CurrentUser() caller: AuthenticatedUser,
  ) {
    return this.service.saveSummary(dto, caller);
  }

  // --- Offboarding summary (org-verified, request -> trigger -> approve) ---

  @Post('summaries/request')
  requestOffboardingSummary(
    @Body() dto: RequestOffboardingSummaryDto,
    @CurrentUser() caller: AuthenticatedUser,
  ) {
    return this.service.requestOffboardingSummary(dto, caller);
  }

  @Get('summaries/pending')
  @Roles(Role.COMPANY_ADMIN, Role.SUPER_ADMIN)
  @RequirePermission(AdminPermission.APPROVE)
  listPendingOffboardingSummaries(
    @CurrentUser() caller: AuthenticatedUser,
    @Query('companyId') companyId?: string,
  ) {
    return this.service.listPendingOffboardingSummaries(caller, companyId);
  }

  @Post('summaries/:id/trigger')
  @Roles(Role.COMPANY_ADMIN, Role.SUPER_ADMIN)
  @RequirePermission(AdminPermission.APPROVE)
  triggerOffboardingSummary(
    @Param('id') id: string,
    @CurrentUser() caller: AuthenticatedUser,
  ) {
    return this.service.triggerOffboardingSummary(id, caller);
  }

  @Patch('summaries/:id')
  @Roles(Role.COMPANY_ADMIN, Role.SUPER_ADMIN)
  @RequirePermission(AdminPermission.EDIT)
  updateOffboardingSummary(
    @Param('id') id: string,
    @Body() dto: UpdateOffboardingSummaryDto,
    @CurrentUser() caller: AuthenticatedUser,
  ) {
    return this.service.updateOffboardingSummary(id, dto, caller);
  }

  @Post('summaries/:id/approve')
  @Roles(Role.COMPANY_ADMIN, Role.SUPER_ADMIN)
  @RequirePermission(AdminPermission.APPROVE)
  approveOffboardingSummary(
    @Param('id') id: string,
    @CurrentUser() caller: AuthenticatedUser,
  ) {
    return this.service.approveOffboardingSummary(id, caller);
  }

  // --- Share links ---------------------------------------------------------

  @Get('shares')
  listShares(@CurrentUser() caller: AuthenticatedUser) {
    return this.service.listShares(caller);
  }

  @Post('shares')
  createShare(
    @Body() dto: CreatePassportShareDto,
    @CurrentUser() caller: AuthenticatedUser,
  ) {
    return this.service.createShare(dto, caller);
  }

  @Patch('shares/:id/revoke')
  revokeShare(
    @Param('id') id: string,
    @CurrentUser() caller: AuthenticatedUser,
  ) {
    return this.service.revokeShare(id, caller);
  }
}

/**
 * Deliberately unguarded: this is the read-only view a prospective employer
 * opens from a share link. The token itself is the credential, and the
 * service checks revoked/expired on every hit.
 */
@Controller('passport')
export class PassportPublicController {
  constructor(private readonly service: CareerPassportService) {}

  @Get(':token')
  getSharedPassport(@Param('token') token: string) {
    return this.service.getSharedPassport(token);
  }
}
