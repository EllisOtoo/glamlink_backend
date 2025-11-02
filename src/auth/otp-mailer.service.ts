import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createTransport, Transporter } from 'nodemailer';

@Injectable()
export class OtpMailerService implements OnModuleInit {
  private readonly logger = new Logger(OtpMailerService.name);
  private readonly transporter?: Transporter;
  private readonly fromAddress: string;
  private smtpHealthy = false;
  private lastVerifyError?: string;

  constructor(private readonly configService: ConfigService) {
    const host = this.configService.get<string>('SMTP_HOST');
    const port = this.configService.get<string>('SMTP_PORT');
    const secure =
      this.configService.get<string | boolean>('SMTP_SECURE') ?? false;
    const user = this.configService.get<string>('SMTP_USER');
    const pass = this.configService.get<string>('SMTP_PASSWORD');

    this.fromAddress =
      this.configService.get<string>('OTP_FROM_EMAIL') ??
      'no-reply@glamlink.local';

    if (host && port) {
      const transportConfig: {
        host: string;
        port: number;
        secure: boolean;
        auth?: {
          user: string;
          pass: string;
        };
      } = {
        host,
        port: Number(port),
        secure: secure === true || secure === 'true',
      };

      if (user && pass) {
        transportConfig.auth = {
          user,
          pass,
        };
      }

      this.transporter = createTransport(transportConfig);
    } else {
      this.logger.warn(
        'SMTP host/port not configured. OTP emails will be logged to console.',
      );
    }
  }

  async onModuleInit(): Promise<void> {
    if (!this.transporter) {
      this.smtpHealthy = false;
      this.lastVerifyError = 'Transporter not configured; using log fallback.';
      this.logger.warn(this.lastVerifyError);
      return;
    }

    try {
      await this.transporter.verify();
      this.smtpHealthy = true;
      this.lastVerifyError = undefined;
      this.logger.log('SMTP transporter verified and ready.');
    } catch (error) {
      this.smtpHealthy = false;
      this.lastVerifyError =
        error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(
        `SMTP verify failed: ${this.lastVerifyError}. Using log fallback until resolved.`,
      );
    }
  }

  async sendLoginCode(email: string, code: string): Promise<void> {
    if (!this.transporter) {
      this.logger.log(`OTP for ${email}: ${code}`);
      return;
    }

    try {
      await this.transporter.sendMail({
        from: this.fromAddress,
        to: email,
        subject: 'Your GlamLink verification code',
        text: `Your verification code is ${code}. It expires in 5 minutes.`,
        html: `<p>Your verification code is <strong>${code}</strong>.</p><p>This code expires in 5 minutes.</p>`,
      });

      this.logger.debug(`OTP email sent to ${email}`);
      this.smtpHealthy = true;
      this.lastVerifyError = undefined;
    } catch (error) {
      const reason = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(
        `Failed to send OTP email to ${email}. Reason: ${reason}. Falling back to log.`,
      );
      this.smtpHealthy = false;
      this.lastVerifyError = reason;
      this.logger.log(`OTP for ${email}: ${code}`);
    }
  }

  getMailerHealth():
    | { status: 'up'; message?: string }
    | { status: 'down'; message: string } {
    if (this.smtpHealthy) {
      return { status: 'up' };
    }

    return {
      status: 'down',
      message: this.lastVerifyError ?? 'Transporter not verified.',
    };
  }
}
