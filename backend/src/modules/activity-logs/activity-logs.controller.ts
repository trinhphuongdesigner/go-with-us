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
import { ActivityLogsService } from './activity-logs.service';
import { CreateActivityLogDto } from './dto/create-activity-log.dto';
import { UpdateActivityLogDto } from './dto/update-activity-log.dto';
import { ListActivityLogsDto } from './dto/list-activity-logs.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/jwt.strategy';

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
