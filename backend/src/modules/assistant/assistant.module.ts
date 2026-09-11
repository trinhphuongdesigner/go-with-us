import { Module } from '@nestjs/common';
import { AiChatModule } from '../ai-chat/ai-chat.module';
import { AssistantController } from './assistant.controller';
import { AssistantService } from './assistant.service';

/**
 * M5 — natural-language staffing search + personal growth companion, both
 * on top of the shared AiChatService.
 */
@Module({
  imports: [AiChatModule],
  controllers: [AssistantController],
  providers: [AssistantService],
})
export class AssistantModule {}
