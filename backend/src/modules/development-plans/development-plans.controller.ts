import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import { DevelopmentPlansService } from './development-plans.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/jwt.strategy';
import { CreateGoalDto } from './dto/create-goal.dto';
import { UpdateGoalDto } from './dto/update-goal.dto';
import { GeneratePlanDto } from './dto/generate-plan.dto';
import { SavePlanDto } from './dto/save-plan.dto';

/**
 * "Development Plan & Goals" — every route scoped to the caller's own data
 * only (an employee's own roadmap; no admin cross-user access in this
 * slice). /generate is the AI skill (proposal only, no persistence); /me
 * (PUT) is the separate explicit-save endpoint — see
 * DevelopmentPlansService's class doc for why these stay two calls.
 */
@Controller('development-plans')
@UseGuards(JwtAuthGuard)
export class DevelopmentPlansController {
  constructor(
    private readonly developmentPlansService: DevelopmentPlansService,
  ) {}

  @Get('goals')
  listGoals(@CurrentUser() caller: AuthenticatedUser) {
    return this.developmentPlansService.listGoals(caller);
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
}
