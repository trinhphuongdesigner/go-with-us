import { Module } from '@nestjs/common';
import { AiChatModule } from '../ai-chat/ai-chat.module';
import { ProfileImportsController } from './profile-imports.controller';
import { ProfileImportsService } from './profile-imports.service';

/**
 * M2 — CV / LinkedIn import. AiChatModule supplies the shared AiChatService
 * every AI feature goes through; PrismaService is global.
 */
@Module({
  imports: [AiChatModule],
  controllers: [ProfileImportsController],
  providers: [ProfileImportsService],
})
export class ProfileImportsModule {}
