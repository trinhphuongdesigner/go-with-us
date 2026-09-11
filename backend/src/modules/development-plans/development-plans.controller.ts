import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { LifeCategory } from '@prisma/client';
import { DevelopmentPlansService } from './development-plans.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/jwt.strategy';
import { CreateGoalDto } from './dto/create-goal.dto';
import { UpdateGoalDto } from './dto/update-goal.dto';
import { GeneratePlanDto } from './dto/generate-plan.dto';
import { SavePlanDto } from './dto/save-plan.dto';
import {
  CreateMilestoneDto,
  CreateTaskDto,
  SaveRoadmapDto,
  UpdateMilestoneDto,
  UpdatePlanSettingsDto,
  UpdateTaskDto,
} from './dto/milestone.dto';

/**
 * "Development Plan & Goals" — every route scoped to the caller's own data
 * only (an employee's own roadmap; no admin cross-user access in this
 * slice). /generate is the AI skill (proposal only, no persistence); /me
 * (PUT) is the separate explicit-save endpoint — see
 * DevelopmentPlansService's class doc for why these stay two calls. The
 * milestone/task routes below are the measurable, checkable part of the
 * same roadmap (M6/M7 in docs/careermate-scope.md); /me/roadmap is the
 * bulk explicit-save counterpart for an AI-proposed milestone tree (see
 * the assistant module's ROADMAP focus for how the proposal is produced).
 */
@Controller('development-plans')
@UseGuards(JwtAuthGuard)
export class DevelopmentPlansController {
  constructor(
    private readonly developmentPlansService: DevelopmentPlansService,
  ) {}

  @Get('goals')
  listGoals(
    @CurrentUser() caller: AuthenticatedUser,
    @Query('category') category?: LifeCategory,
  ) {
    return this.developmentPlansService.listGoals(caller, category);
  }

  @Post('goals')
  createGoal(
    @Body() dto: CreateGoalDto,
    @CurrentUser() caller: AuthenticatedUser,
  ) {
    return this.developmentPlansService.createGoal(dto, caller);
  }

  @Patch('goals/:id')
  updateGoal(
    @Param('id') id: string,
    @Body() dto: UpdateGoalDto,
    @CurrentUser() caller: AuthenticatedUser,
  ) {
    return this.developmentPlansService.updateGoal(id, dto, caller);
  }

  @Delete('goals/:id')
  removeGoal(
    @Param('id') id: string,
    @CurrentUser() caller: AuthenticatedUser,
  ) {
    return this.developmentPlansService.removeGoal(id, caller);
  }

  @Post('generate')
  generate(
    @Body() dto: GeneratePlanDto,
    @CurrentUser() caller: AuthenticatedUser,
  ) {
    return this.developmentPlansService.generate(dto, caller);
  }

  @Put('me')
  saveMyPlan(
    @Body() dto: SavePlanDto,
    @CurrentUser() caller: AuthenticatedUser,
  ) {
    return this.developmentPlansService.saveMyPlan(dto, caller);
  }

  @Get('me')
  getMyPlan(@CurrentUser() caller: AuthenticatedUser) {
    return this.developmentPlansService.getMyPlan(caller);
  }

  // ---- Milestones & tasks --------------------------------------------

  @Get('me/milestones')
  listMilestones(
    @CurrentUser() caller: AuthenticatedUser,
    @Query('category') category?: LifeCategory,
  ) {
    return this.developmentPlansService.listMilestones(caller, category);
  }

  @Post('me/milestones')
  createMilestone(
    @Body() dto: CreateMilestoneDto,
    @CurrentUser() caller: AuthenticatedUser,
  ) {
    return this.developmentPlansService.createMilestone(dto, caller);
  }

  @Patch('milestones/:id')
  updateMilestone(
    @Param('id') id: string,
    @Body() dto: UpdateMilestoneDto,
    @CurrentUser() caller: AuthenticatedUser,
  ) {
    return this.developmentPlansService.updateMilestone(id, dto, caller);
  }

  @Delete('milestones/:id')
  removeMilestone(
    @Param('id') id: string,
    @CurrentUser() caller: AuthenticatedUser,
  ) {
    return this.developmentPlansService.removeMilestone(id, caller);
  }

  @Post('milestones/:id/tasks')
  createTask(
    @Param('id') milestoneId: string,
    @Body() dto: CreateTaskDto,
    @CurrentUser() caller: AuthenticatedUser,
  ) {
    return this.developmentPlansService.createTask(
      milestoneId,
      dto.title,
      dto.metric,
      caller,
    );
  }

  @Patch('tasks/:id')
  updateTask(
    @Param('id') id: string,
    @Body() dto: UpdateTaskDto,
    @CurrentUser() caller: AuthenticatedUser,
  ) {
    return this.developmentPlansService.updateTask(id, dto, caller);
  }

  @Delete('tasks/:id')
  removeTask(
    @Param('id') id: string,
    @CurrentUser() caller: AuthenticatedUser,
  ) {
    return this.developmentPlansService.removeTask(id, caller);
  }

  /** Explicit save of a reviewed AI roadmap proposal — replaces the tree. */
  @Post('me/roadmap')
  saveRoadmap(
    @Body() dto: SaveRoadmapDto,
    @CurrentUser() caller: AuthenticatedUser,
  ) {
    return this.developmentPlansService.saveRoadmap(dto, caller);
  }

  @Patch('me/settings')
  updatePlanSettings(
    @Body() dto: UpdatePlanSettingsDto,
    @CurrentUser() caller: AuthenticatedUser,
  ) {
    return this.developmentPlansService.updatePlanSettings(dto, caller);
  }
}
