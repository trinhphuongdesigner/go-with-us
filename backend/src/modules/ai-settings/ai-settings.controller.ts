import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseEnumPipe,
  Put,
  UseGuards,
} from '@nestjs/common';
import { AiProvider, Role } from '@prisma/client';
import { AiSettingsService } from './ai-settings.service';
import { UpsertAiSettingDto } from './dto/upsert-ai-setting.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';

/**
 * Provider connections are platform-level (shared across the whole app,
 * same "API Keys & Connections" pattern as Workflow Pro) — SUPER_ADMIN only.
 */
@Controller('ai-settings')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.SUPER_ADMIN)
export class AiSettingsController {
  constructor(private readonly aiSettingsService: AiSettingsService) {}

  @Get()
  findAll() {
    return this.aiSettingsService.findAll();
  }

  @Get(':provider')
  findOne(
    @Param('provider', new ParseEnumPipe(AiProvider)) provider: AiProvider,
  ) {
    return this.aiSettingsService.findOne(provider);
  }

  @Put(':provider')
  upsert(
    @Param('provider', new ParseEnumPipe(AiProvider)) provider: AiProvider,
    @Body() dto: UpsertAiSettingDto,
  ) {
    return this.aiSettingsService.upsert(provider, dto);
  }

  @Delete(':provider')
  remove(
    @Param('provider', new ParseEnumPipe(AiProvider)) provider: AiProvider,
  ) {
    return this.aiSettingsService.remove(provider);
  }
}
