import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

/**
 * Shared Prisma client wrapped as a Nest provider. Every module that needs
 * DB access should inject this rather than instantiating its own
 * PrismaClient — see PrismaModule below (global, imported once in
 * AppModule).
 */
@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
