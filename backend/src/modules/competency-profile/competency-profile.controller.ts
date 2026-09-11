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
import { CompetencyProfileService } from './competency-profile.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/jwt.strategy';
import {
  CreateCertificationDto,
  UpdateCertificationDto,
} from './dto/certification.dto';
import {
  CreateProjectExperienceDto,
  UpdateProjectExperienceDto,
} from './dto/project-experience.dto';
import { CreateAwardDto, UpdateAwardDto } from './dto/award.dto';

/**
 * Competency profile (M1 in docs/careermate-scope.md) — certifications,
 * project experience and awards, plus the merged timeline view.
 *
 * Reads accept `?userId=` and fall back to the caller; writes are always
 * owner-scoped (you edit your own profile, admins only look).
 */
@Controller('competency-profile')
@UseGuards(JwtAuthGuard)
export class CompetencyProfileController {
  constructor(private readonly service: CompetencyProfileService) {}

  @Get()
  getProfile(
    @CurrentUser() caller: AuthenticatedUser,
    @Query('userId') userId?: string,
  ) {
    return this.service.getProfile(caller, userId);
  }

  // --- Certifications ------------------------------------------------------

  @Get('certifications')
  listCertifications(
    @CurrentUser() caller: AuthenticatedUser,
    @Query('userId') userId?: string,
  ) {
    return this.service.listCertifications(caller, userId);
  }

  @Post('certifications')
  createCertification(
    @Body() dto: CreateCertificationDto,
    @CurrentUser() caller: AuthenticatedUser,
  ) {
    return this.service.createCertification(dto, caller);
  }

  @Patch('certifications/:id')
  updateCertification(
    @Param('id') id: string,
    @Body() dto: UpdateCertificationDto,
    @CurrentUser() caller: AuthenticatedUser,
  ) {
    return this.service.updateCertification(id, dto, caller);
  }

  @Delete('certifications/:id')
  removeCertification(
    @Param('id') id: string,
    @CurrentUser() caller: AuthenticatedUser,
  ) {
    return this.service.removeCertification(id, caller);
  }

  // --- Project experience --------------------------------------------------

  @Get('projects')
  listProjects(
    @CurrentUser() caller: AuthenticatedUser,
    @Query('userId') userId?: string,
  ) {
    return this.service.listProjects(caller, userId);
  }

  @Post('projects')
  createProject(
    @Body() dto: CreateProjectExperienceDto,
    @CurrentUser() caller: AuthenticatedUser,
  ) {
    return this.service.createProject(dto, caller);
  }

  @Patch('projects/:id')
  updateProject(
    @Param('id') id: string,
    @Body() dto: UpdateProjectExperienceDto,
    @CurrentUser() caller: AuthenticatedUser,
  ) {
    return this.service.updateProject(id, dto, caller);
  }

  @Delete('projects/:id')
  removeProject(
    @Param('id') id: string,
    @CurrentUser() caller: AuthenticatedUser,
  ) {
    return this.service.removeProject(id, caller);
  }

  // --- Awards --------------------------------------------------------------

  @Get('awards')
  listAwards(
    @CurrentUser() caller: AuthenticatedUser,
    @Query('userId') userId?: string,
  ) {
    return this.service.listAwards(caller, userId);
  }

  @Post('awards')
  createAward(
    @Body() dto: CreateAwardDto,
    @CurrentUser() caller: AuthenticatedUser,
  ) {
    return this.service.createAward(dto, caller);
  }

  @Patch('awards/:id')
  updateAward(
    @Param('id') id: string,
    @Body() dto: UpdateAwardDto,
    @CurrentUser() caller: AuthenticatedUser,
  ) {
    return this.service.updateAward(id, dto, caller);
  }

  @Delete('awards/:id')
  removeAward(
    @Param('id') id: string,
    @CurrentUser() caller: AuthenticatedUser,
  ) {
    return this.service.removeAward(id, caller);
  }
}
