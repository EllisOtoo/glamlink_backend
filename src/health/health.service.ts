import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma';
import { OtpMailerService } from '../auth/otp-mailer.service';

type HealthStatus = 'ok' | 'degraded';

export interface HealthCheckResponse {
  status: HealthStatus;
  timestamp: string;
  uptimeSeconds: number;
  checks: {
    database: 'up' | 'down';
    email: 'up' | 'down';
  };
  details?: {
    database?: string;
    email?: string;
  };
}

@Injectable()
export class HealthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly otpMailer: OtpMailerService,
  ) {}

  async check(): Promise<HealthCheckResponse> {
    const timestamp = new Date().toISOString();
    let databaseStatus: 'up' | 'down' = 'up';
    let databaseMessage: string | undefined;

    try {
      // Prisma Client methods are generated at build time; no-unsafe-* rules misclassify them, so disable locally.
      // Simple connectivity probe that works even before migrations run.
      await this.prisma.$queryRaw`SELECT 1`;
    } catch (error) {
      databaseStatus = 'down';
      databaseMessage =
        error instanceof Error ? error.message : 'Unknown database error';
    }

    const mailerHealth = this.otpMailer.getMailerHealth();
    const uptimeSeconds = Math.round(process.uptime());
    const status: HealthStatus =
      databaseStatus === 'down' || mailerHealth.status === 'down'
        ? 'degraded'
        : 'ok';

    const details: Partial<Record<'database' | 'email', string>> = {
      ...(databaseMessage ? { database: databaseMessage } : {}),
      ...(mailerHealth.status === 'down' && mailerHealth.message
        ? { email: mailerHealth.message }
        : {}),
    };

    const response: HealthCheckResponse = {
      status,
      timestamp,
      uptimeSeconds,
      checks: {
        database: databaseStatus,
        email: mailerHealth.status,
      },
    };

    if (Object.keys(details).length > 0) {
      response.details = details;
    }

    return response;
  }
}
