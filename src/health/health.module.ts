import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma';
import { AuthModule } from '../auth/auth.module';
import { HealthController } from './health.controller';
import { HealthService } from './health.service';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [HealthController],
  providers: [HealthService],
})
export class HealthModule {}
