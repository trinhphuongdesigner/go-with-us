import { Module } from '@nestjs/common';
import { AiChatModule } from '../ai-chat/ai-chat.module';
import { DevelopmentPlansController } from './development-plans.controller';
import { DevelopmentPlansService } from './development-plans.service';

/**
 * PrismaService is global (see prisma/prisma.module.ts) so it doesn't need
 * to appear here. AiChatModule is imported for AiChatService, the shared
 * entry point every AI-assisted feature goes through (see
 * ai-chat.module.ts's own doc comment).
 */
@Module({
  imports: [AiChatModule],
  controllers: [DevelopmentPlansController],
  providers: [DevelopmentPlansService],
})
export class DevelopmentPlansModule {}
