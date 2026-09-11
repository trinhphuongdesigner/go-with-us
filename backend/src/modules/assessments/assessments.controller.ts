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
import { Role } from '@prisma/client';
import { AssessmentsService } from './assessments.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/jwt.strategy';
import {
  CreateAssessmentTemplateDto,
  UpdateAssessmentTemplateDto,
} from './dto/assessment-template.dto';
import {
  CreateAssessmentCycleDto,
  CreateAssessmentDto,
  ReviewAssessmentDto,
  UpdateAssessmentCycleDto,
  UpdateAssessmentDto,
} from './dto/assessment.dto';

/**
 * M3 — Cross Assessment. Three layers in one module:
 *   templates  (company builds its own scale — HR only)
 *   cycles     (a month-long round against a template — HR only)
 *   assessments (employees fill in, BOD approves)
 *
 * Approving snapshots the template onto the record, which is what lets an
 * approved assessment follow the person for life.
 */
@Controller('assessments')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AssessmentsController {
  constructor(private readonly service: AssessmentsService) {}

  // --- Templates -----------------------------------------------------------

  @Get('templates')
  @Roles(Role.HR, Role.SUPER_ADMIN)
  listTemplates(
    @CurrentUser() caller: AuthenticatedUser,
    @Query('companyId') companyId?: string,
  ) {
    return this.service.listTemplates(caller, companyId);
  }

  @Get('templates/:id')
  getTemplate(
    @Param('id') id: string,
    @CurrentUser() caller: AuthenticatedUser,
  ) {
    return this.service.getTemplate(id, caller);
  }

  @Post('templates')
  @Roles(Role.HR, Role.SUPER_ADMIN)
  createTemplate(
    @Body() dto: CreateAssessmentTemplateDto,
    @CurrentUser() caller: AuthenticatedUser,
  ) {
    return this.service.createTemplate(dto, caller);
  }

  @Patch('templates/:id')
  @Roles(Role.HR, Role.SUPER_ADMIN)
  updateTemplate(
    @Param('id') id: string,
    @Body() dto: UpdateAssessmentTemplateDto,
    @CurrentUser() caller: AuthenticatedUser,
  ) {
    return this.service.updateTemplate(id, dto, caller);
  }

  @Delete('templates/:id')
  @Roles(Role.HR, Role.SUPER_ADMIN)
  removeTemplate(
    @Param('id') id: string,
    @CurrentUser() caller: AuthenticatedUser,
  ) {
    return this.service.removeTemplate(id, caller);
  }

  // --- Cycles --------------------------------------------------------------

  @Get('cycles')
  @Roles(Role.HR, Role.SUPER_ADMIN)
  listCycles(
    @CurrentUser() caller: AuthenticatedUser,
    @Query('companyId') companyId?: string,
  ) {
    return this.service.listCycles(caller, companyId);
  }

  @Get('cycles/active')
  getActiveCycle(@CurrentUser() caller: AuthenticatedUser) {
    return this.service.getActiveCycle(caller);
  }

  @Post('cycles')
  @Roles(Role.HR, Role.SUPER_ADMIN)
  createCycle(
    @Body() dto: CreateAssessmentCycleDto,
    @CurrentUser() caller: AuthenticatedUser,
  ) {
    return this.service.createCycle(dto, caller);
  }

  @Patch('cycles/:id')
  @Roles(Role.HR, Role.SUPER_ADMIN)
  updateCycle(
    @Param('id') id: string,
    @Body() dto: UpdateAssessmentCycleDto,
    @CurrentUser() caller: AuthenticatedUser,
  ) {
    return this.service.updateCycle(id, dto, caller);
  }

  // --- Assessments ---------------------------------------------------------

  @Get('pending-approval')
  @Roles(Role.BOD, Role.SUPER_ADMIN)
  listPendingApproval(@CurrentUser() caller: AuthenticatedUser) {
    return this.service.listPendingApproval(caller);
  }

  @Get()
  listAssessments(
    @CurrentUser() caller: AuthenticatedUser,
    @Query('scope') scope?: 'mine' | 'received',
    @Query('userId') userId?: string,
  ) {
    return this.service.listAssessments(caller, scope ?? 'received', userId);
  }

  @Get(':id')
  getAssessment(
    @Param('id') id: string,
    @CurrentUser() caller: AuthenticatedUser,
  ) {
    return this.service.getAssessment(id, caller);
  }

  @Post()
  createAssessment(
    @Body() dto: CreateAssessmentDto,
    @CurrentUser() caller: AuthenticatedUser,
  ) {
    return this.service.createAssessment(dto, caller);
  }

  @Patch(':id')
  updateAssessment(
    @Param('id') id: string,
    @Body() dto: UpdateAssessmentDto,
    @CurrentUser() caller: AuthenticatedUser,
  ) {
    return this.service.updateAssessment(id, dto, caller);
  }

  @Post(':id/submit')
  submitAssessment(
    @Param('id') id: string,
    @Body() dto: UpdateAssessmentDto,
    @CurrentUser() caller: AuthenticatedUser,
  ) {
    return this.service.submitAssessment(id, dto, caller);
  }

  @Post(':id/approve')
  @Roles(Role.BOD, Role.SUPER_ADMIN)
  approveAssessment(
    @Param('id') id: string,
    @CurrentUser() caller: AuthenticatedUser,
  ) {
    return this.service.approveAssessment(id, caller);
  }

  @Post(':id/reject')
  @Roles(Role.BOD, Role.SUPER_ADMIN)
  rejectAssessment(
    @Param('id') id: string,
    @Body() dto: ReviewAssessmentDto,
    @CurrentUser() caller: AuthenticatedUser,
  ) {
    return this.service.rejectAssessment(id, dto, caller);
  }
}
