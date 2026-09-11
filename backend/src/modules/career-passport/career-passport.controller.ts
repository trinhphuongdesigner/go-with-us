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
import { CareerPassportService } from './career-passport.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/jwt.strategy';
import {
  CreateEmploymentDto,
  CreatePassportShareDto,
  GenerateCareerSummaryDto,
  SaveCareerSummaryDto,
  UpdateEmploymentDto,
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
@UseGuards(JwtAuthGuard)
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
