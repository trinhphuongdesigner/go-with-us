import { Module } from '@nestjs/common';
import { JobRequirementsController } from './job-requirements.controller';
import { JobRequirementsService } from './job-requirements.service';
import { AiChatModule } from '../ai-chat/ai-chat.module';

@Module({
  imports: [AiChatModule],
  controllers: [JobRequirementsController],
  providers: [JobRequirementsService],
})
export class JobRequirementsModule {}
