import { Module } from '@nestjs/common';
import { DevelopmentPlansController } from './development-plans.controller';
import { DevelopmentPlansService } from './development-plans.service';

@Module({
  controllers: [DevelopmentPlansController],
  providers: [DevelopmentPlansService],
})
export class DevelopmentPlansModule {}
