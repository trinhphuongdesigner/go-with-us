import { Module } from '@nestjs/common';
import { ActivityLogsController } from './activity-logs.controller';
import { ActivityLogsService } from './activity-logs.service';

/**
 * Employee "life activities" log — see activity-logs.controller.ts for the
 * visibility rules. PrismaService is provided globally by PrismaModule, so
 * nothing else needs importing here.
 */
@Module({
  controllers: [ActivityLogsController],
  providers: [ActivityLogsService],
})
export class ActivityLogsModule {}
