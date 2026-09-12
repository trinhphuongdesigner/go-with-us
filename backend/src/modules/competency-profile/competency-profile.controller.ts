import {
  Body,
  Controller,
  Delete,
  FileTypeValidator,
  Get,
  MaxFileSizeValidator,
  Param,
  ParseFilePipe,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
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

const EVIDENCE_MAX_BYTES = 10 * 1024 * 1024;
const EVIDENCE_MIME =
  /^(image\/(jpeg|png|webp|gif)|application\/(pdf|msword|vnd\.openxmlformats-officedocument\.wordprocessingml\.document|vnd\.ms-excel|vnd\.openxmlformats-officedocument\.spreadsheetml\.sheet))$/;

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

  @Post('certifications/evidence')
  @UseInterceptors(
    FileInterceptor('evidence', {
      limits: { files: 1, fileSize: EVIDENCE_MAX_BYTES },
    }),
  )
  uploadCertificationEvidence(
    @UploadedFile(
      new ParseFilePipe({
        validators: [
          new MaxFileSizeValidator({
            maxSize: EVIDENCE_MAX_BYTES,
            errorMessage: 'Evidence must not exceed 10 MB',
          }),
          new FileTypeValidator({
            fileType: EVIDENCE_MIME,
            overrideMimeType: true,
            errorMessage:
              'Evidence must be JPEG, PNG, WebP, GIF, PDF, DOC, DOCX, XLS or XLSX',
          }),
        ],
      }),
    )
    file: Express.Multer.File,
    @CurrentUser() caller: AuthenticatedUser,
  ) {
    return this.service.uploadCertificationEvidence(file, caller);
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

  @Post('awards/evidence')
  @UseInterceptors(
    FileInterceptor('evidence', {
      limits: { files: 1, fileSize: EVIDENCE_MAX_BYTES },
    }),
  )
  uploadEvidence(
    @UploadedFile(
      new ParseFilePipe({
        validators: [
          new MaxFileSizeValidator({
            maxSize: EVIDENCE_MAX_BYTES,
            errorMessage: 'Evidence must not exceed 10 MB',
          }),
          new FileTypeValidator({
            fileType: EVIDENCE_MIME,
            overrideMimeType: true,
            errorMessage:
              'Evidence must be JPEG, PNG, WebP, GIF, PDF, DOC, DOCX, XLS or XLSX',
          }),
        ],
      }),
    )
    file: Express.Multer.File,
    @CurrentUser() caller: AuthenticatedUser,
  ) {
    return this.service.uploadEvidence(file, caller);
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
