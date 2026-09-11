import { Module } from '@nestjs/common';
import { JobRequirementsController } from './job-requirements.controller';
import { JobRequirementsService } from './job-requirements.service';

@Module({
  controllers: [JobRequirementsController],
  providers: [JobRequirementsService],
})
export class JobRequirementsModule {}
