import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';

/**
 * Global module — imported once in AppModule, then PrismaService is
 * injectable anywhere without re-importing this module. Keep this the only
 * place PrismaClient is instantiated.
 */
@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}
