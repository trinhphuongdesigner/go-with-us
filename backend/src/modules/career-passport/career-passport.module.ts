import { Module } from '@nestjs/common';
import { AiChatModule } from '../ai-chat/ai-chat.module';
import {
  CareerPassportController,
  PassportPublicController,
} from './career-passport.controller';
import { CareerPassportService } from './career-passport.service';

/**
 * M4 — portable career record. Two controllers: the authenticated one for
 * the owner/admin, and the token-only public one a new employer reads.
 */
@Module({
  imports: [AiChatModule],
  controllers: [CareerPassportController, PassportPublicController],
  providers: [CareerPassportService],
})
export class CareerPassportModule {}
