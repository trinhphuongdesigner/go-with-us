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
import { ActivityLogsService } from './activity-logs.service';
import { CreateActivityLogDto } from './dto/create-activity-log.dto';
import { UpdateActivityLogDto } from './dto/update-activity-log.dto';
import { ListActivityLogsDto } from './dto/list-activity-logs.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/jwt.strategy';

const EVIDENCE_MAX_BYTES = 10 * 1024 * 1024;
const EVIDENCE_MIME =
  /^(image\/(jpeg|png|webp|gif)|application\/(pdf|msword|vnd\.openxmlformats-officedocument\.wordprocessingml\.document|vnd\.ms-excel|vnd\.openxmlformats-officedocument\.spreadsheetml\.sheet))$/;

/**
 * Employee-authored "life activities" log (hobbies, volunteering,
 * certifications, etc.) — feeds AI-suggested development plans in a later
 * phase. Every mutation is scoped to the caller's own rows; reading
 * someone else's log is allowed only for COMPANY_ADMIN (same company) and
 * SUPER_ADMIN, mirrored from UsersService's visibility rules.
 */
@Controller('activity-logs')
@UseGuards(JwtAuthGuard)
export class ActivityLogsController {
  constructor(private readonly activityLogsService: ActivityLogsService) {}

  @Get()
  findAll(
    @Query() query: ListActivityLogsDto,
    @CurrentUser() caller: AuthenticatedUser,
  ) {
    return this.activityLogsService.findAll(caller, query.userId);
  }

  @Post()
  create(
    @Body() dto: CreateActivityLogDto,
    @CurrentUser() caller: AuthenticatedUser,
  ) {
    return this.activityLogsService.create(dto, caller);
  }

  @Post('evidence')
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
    return this.activityLogsService.uploadEvidence(file, caller);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateActivityLogDto,
    @CurrentUser() caller: AuthenticatedUser,
  ) {
    return this.activityLogsService.update(id, dto, caller);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @CurrentUser() caller: AuthenticatedUser) {
    return this.activityLogsService.remove(id, caller);
  }
}
