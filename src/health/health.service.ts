import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma';

type HealthStatus = 'ok' | 'degraded';

export interface HealthCheckResponse {
  status: HealthStatus;
  timestamp: string;
  uptimeSeconds: number;
  checks: {
    database: 'up' | 'down';
  };
  details?: {
    database?: string;
  };
}

@Injectable()
export class HealthService {
  constructor(private readonly prisma: PrismaService) {}

  async check(): Promise<HealthCheckResponse> {
    const timestamp = new Date().toISOString();

    try {
      // Prisma Client methods are generated at build time; no-unsafe-* rules misclassify them, so disable locally.
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
      // Simple connectivity probe that works even before migrations run.
      await this.prisma.$queryRaw`SELECT 1`;

      return {
        status: 'ok',
        timestamp,
        uptimeSeconds: Math.round(process.uptime()),
        checks: {
          database: 'up',
        },
      };
    } catch (error) {
      const reason =
        error instanceof Error ? error.message : 'Unknown database error';

      return {
        status: 'degraded',
        timestamp,
        uptimeSeconds: Math.round(process.uptime()),
        checks: {
          database: 'down',
        },
        details: {
          database: reason,
        },
      };
    }
  }
}
