import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  async onModuleInit() {
    // Prisma Client attaches lifecycle helpers dynamically; disable lint for generated method.

    await super.$connect();
  }

  async onModuleDestroy() {
    await super.$disconnect();
  }
}
