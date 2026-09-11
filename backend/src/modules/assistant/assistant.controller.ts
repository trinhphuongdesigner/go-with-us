import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { AssistantService } from './assistant.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/jwt.strategy';
import { AssistantQueryDto, UpdateConversationDto } from './dto/assistant.dto';

/**
 * M5 — the cross-cutting assistant. Same endpoint for both audiences; the
 * service decides what context the caller is allowed to see (company roster
 * for admins, own record only for employees).
 */
@Controller('assistant')
@UseGuards(JwtAuthGuard)
export class AssistantController {
  constructor(private readonly service: AssistantService) {}

  @Get('conversations')
  listConversations(@CurrentUser() caller: AuthenticatedUser) {
    return this.service.listConversations(caller);
  }

  @Get('conversations/:id')
  getConversation(
    @Param('id') id: string,
    @CurrentUser() caller: AuthenticatedUser,
  ) {
    return this.service.getConversation(id, caller);
  }

  @Delete('conversations/:id')
  removeConversation(
    @Param('id') id: string,
    @CurrentUser() caller: AuthenticatedUser,
  ) {
    return this.service.removeConversation(id, caller);
  }

  @Patch('conversations/:id')
  updateConversation(
    @Param('id') id: string,
    @Body() dto: UpdateConversationDto,
    @CurrentUser() caller: AuthenticatedUser,
  ) {
    return this.service.updateConversation(id, dto, caller);
  }

  @Post('query')
  query(
    @Body() dto: AssistantQueryDto,
    @CurrentUser() caller: AuthenticatedUser,
  ) {
    return this.service.query(dto, caller);
  }
}
