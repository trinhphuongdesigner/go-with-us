import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AdminPermission, Role } from '@prisma/client';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { JobRequirementsService } from './job-requirements.service';
import { CreateJobRequirementDto } from './dto/create-job-requirement.dto';
import { UpdateJobRequirementDto } from './dto/update-job-requirement.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/jwt.strategy';

/**
 * Job Requirements & AI Candidate Matching — see
 * D:\Coding\AI_Tool\docs\skills.md's conventions for the "match" AI skill's
 * shape (proposal-only, no persistence step — this one is read-only
 * analysis, so it's returned straight to the frontend, unlike every skill
 * in that reference doc which has an explicit confirm/save step).
 */
@Controller('job-requirements')
@UseGuards(JwtAuthGuard, RolesGuard)
export class JobRequirementsController {
  constructor(
    private readonly jobRequirementsService: JobRequirementsService,
  ) {}

  @Get()
  findAll(
    @CurrentUser() caller: AuthenticatedUser,
    @Query('companyId') companyId?: string,
  ) {
    return this.jobRequirementsService.findAll(caller, companyId);
  }

  @Post()
  @Roles(Role.COMPANY_ADMIN, Role.SUPER_ADMIN)
  @RequirePermission(AdminPermission.COLLECT)
  create(
    @Body() dto: CreateJobRequirementDto,
    @CurrentUser() caller: AuthenticatedUser,
  ) {
    return this.jobRequirementsService.create(dto, caller);
  }

  @Patch(':id')
  @RequirePermission(AdminPermission.COLLECT)
  update(
    @Param('id') id: string,
    @Body() dto: UpdateJobRequirementDto,
    @CurrentUser() caller: AuthenticatedUser,
  ) {
    return this.jobRequirementsService.update(id, dto, caller);
  }

  @Delete(':id')
  @RequirePermission(AdminPermission.COLLECT)
  remove(@Param('id') id: string, @CurrentUser() caller: AuthenticatedUser) {
    return this.jobRequirementsService.remove(id, caller);
  }

  @Post(':id/match')
  @Roles(Role.COMPANY_ADMIN, Role.SUPER_ADMIN)
  @RequirePermission(AdminPermission.VIEW)
  match(@Param('id') id: string, @CurrentUser() caller: AuthenticatedUser) {
    return this.jobRequirementsService.match(id, caller);
  }
}
