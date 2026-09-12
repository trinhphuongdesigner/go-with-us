import { Module } from '@nestjs/common';
import { CompetencyRequestsController } from './competency-requests.controller';
import { CompetencyRequestsService } from './competency-requests.service';

@Module({
  controllers: [CompetencyRequestsController],
  providers: [CompetencyRequestsService],
})
export class CompetencyRequestsModule {}
