import { Module } from '@nestjs/common';
import { AssessmentsController } from './assessments.controller';
import { AssessmentsService } from './assessments.service';

/**
 * M3 — Cross Assessment with per-company criteria. No AI in this module:
 * the scale is the company's own, the AI only reads the results later when
 * writing a CareerSummary.
 */
@Module({
  controllers: [AssessmentsController],
  providers: [AssessmentsService],
  exports: [AssessmentsService],
})
export class AssessmentsModule {}
