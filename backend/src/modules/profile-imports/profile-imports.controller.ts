import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ProfileImportsService } from './profile-imports.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/jwt.strategy';
import {
  ApplyProfileImportDto,
  CreateProfileImportDto,
} from './dto/profile-import.dto';

/**
 * M2 — CV / LinkedIn import. Owner-scoped throughout: you only ever import
 * into your own profile.
 *
 * `parse` is the AI skill (proposal only, writes nothing to the profile) and
 * `apply` is the explicit save step — the same split as
 * development-plans' generate/save.
 */
@Controller('profile-imports')
@UseGuards(JwtAuthGuard)
export class ProfileImportsController {
  constructor(private readonly service: ProfileImportsService) {}

  @Get()
  list(@CurrentUser() caller: AuthenticatedUser) {
    return this.service.list(caller);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser() caller: AuthenticatedUser) {
    return this.service.findOne(id, caller);
  }

  @Post()
  create(
    @Body() dto: CreateProfileImportDto,
    @CurrentUser() caller: AuthenticatedUser,
  ) {
    return this.service.create(dto, caller);
  }

  @Post(':id/parse')
  parse(@Param('id') id: string, @CurrentUser() caller: AuthenticatedUser) {
    return this.service.parse(id, caller);
  }

  @Post(':id/apply')
  apply(
    @Param('id') id: string,
    @Body() dto: ApplyProfileImportDto,
    @CurrentUser() caller: AuthenticatedUser,
  ) {
    return this.service.apply(id, dto, caller);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @CurrentUser() caller: AuthenticatedUser) {
    return this.service.remove(id, caller);
  }
}
