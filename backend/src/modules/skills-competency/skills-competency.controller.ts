import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { SkillsCompetencyService } from './skills-competency.service';
import { UpsertSkillDto } from './dto/upsert-skill.dto';
import { BulkUpsertEmployeeSkillsDto } from './dto/bulk-upsert-employee-skills.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/jwt.strategy';

@Controller('skills-competency')
@UseGuards(JwtAuthGuard)
export class SkillsCompetencyController {
  constructor(
    private readonly skillsCompetencyService: SkillsCompetencyService,
  ) {}

  @Get('skills')
  listSkills() {
    return this.skillsCompetencyService.listSkills();
  }

  @Post('skills')
  upsertSkill(@Body() dto: UpsertSkillDto) {
    return this.skillsCompetencyService.upsertSkill(dto);
  }

  @Get('users/:userId')
  listUserSkills(
    @Param('userId') userId: string,
    @CurrentUser() caller: AuthenticatedUser,
  ) {
    return this.skillsCompetencyService.listUserSkills(userId, caller);
  }

  @Put('users/:userId/skills')
  bulkUpsertOwnSkills(
    @Param('userId') userId: string,
    @Body() dto: BulkUpsertEmployeeSkillsDto,
    @CurrentUser() caller: AuthenticatedUser,
  ) {
    return this.skillsCompetencyService.bulkUpsertOwnSkills(
      userId,
      dto.skills,
      caller,
    );
  }

  @Get('insight/:userId')
  @UseGuards(RolesGuard)
  @Roles(Role.HR, Role.BOD, Role.SUPER_ADMIN)
  getInsight(
    @Param('userId') userId: string,
    @CurrentUser() caller: AuthenticatedUser,
  ) {
    return this.skillsCompetencyService.getInsight(userId, caller);
  }
}
