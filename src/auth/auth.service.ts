import {
  BadRequestException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { Prisma, Session, User, UserRole } from '@prisma/client';
import type { DecodedIdToken } from 'firebase-admin/auth';
import { randomBytes, randomInt, createHash } from 'node:crypto';
import { PrismaService } from '../prisma';
import { OtpMailerService } from './otp-mailer.service';
import { FirebaseAdminService } from '../firebase';

const OTP_CODE_LENGTH = 6;
const OTP_TTL_SECONDS = 5 * 60;
const OTP_RESEND_COOLDOWN_SECONDS = 60;
const OTP_MAX_ATTEMPTS = 5;
const SESSION_TTL_SECONDS = 30 * 24 * 60 * 60; // 30 days

export interface AuthSession {
  token: string;
  expiresAt: Date;
  session: Session;
  user: User;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly otpMailer: OtpMailerService,
    private readonly firebaseAdmin: FirebaseAdminService,
  ) {}

  async requestEmailOtp(email: string): Promise<void> {
    const normalizedEmail = this.normalizeEmail(email);

    const recentOtp = await this.prisma.emailOtp.findFirst({
      where: {
        email: normalizedEmail,
        createdAt: {
          gte: new Date(Date.now() - OTP_RESEND_COOLDOWN_SECONDS * 1000),
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (recentOtp) {
      throw new BadRequestException(
        'OTP recently sent. Please wait before requesting another code.',
      );
    }

    const code = this.generateOtpCode();

    await this.prisma.emailOtp.create({
      data: {
        email: normalizedEmail,
        codeHash: this.hashString(code),
        expiresAt: new Date(Date.now() + OTP_TTL_SECONDS * 1000),
      },
    });

    await this.otpMailer.sendLoginCode(normalizedEmail, code);
  }

  async verifyEmailOtp(params: {
    email: string;
    code: string;
    requestedRole?: UserRole;
    metadata?: {
      userAgent?: string;
      clientIp?: string;
    };
  }): Promise<AuthSession> {
    const normalizedEmail = this.normalizeEmail(params.email);
    const sanitizedCode = this.sanitizeOtpCode(params.code);
    const requestedRole = params.requestedRole ?? UserRole.CUSTOMER;

    return this.prisma.$transaction(async (tx) => {
      const otpRecord = await tx.emailOtp.findFirst({
        where: {
          email: normalizedEmail,
          consumedAt: null,
        },
        orderBy: { createdAt: 'desc' },
      });

      if (!otpRecord) {
        throw new UnauthorizedException('Invalid or expired code.');
      }

      if (otpRecord.expiresAt.getTime() <= Date.now()) {
        await tx.emailOtp.update({
          where: { id: otpRecord.id },
          data: { consumedAt: new Date() },
        });
        throw new UnauthorizedException('Invalid or expired code.');
      }

      if (otpRecord.attemptCount >= OTP_MAX_ATTEMPTS) {
        await tx.emailOtp.update({
          where: { id: otpRecord.id },
          data: { consumedAt: new Date() },
        });
        throw new UnauthorizedException(
          'Too many attempts. Request a new code.',
        );
      }

      const codeMatches = otpRecord.codeHash === this.hashString(sanitizedCode);

      if (!codeMatches) {
        await tx.emailOtp.update({
          where: { id: otpRecord.id },
          data: { attemptCount: { increment: 1 } },
        });
        throw new UnauthorizedException('Invalid or expired code.');
      }

      const { user, created } = await this.upsertUserInTransaction(
        tx,
        normalizedEmail,
        requestedRole,
      );

      await tx.emailOtp.update({
        where: { id: otpRecord.id },
        data: {
          consumedAt: new Date(),
          attemptCount: { increment: 1 },
          userId: user.id,
        },
      });

      await tx.user.update({
        where: { id: user.id },
        data: { lastSignedInAt: new Date() },
      });

      const session = await this.createSession(tx, {
        userId: user.id,
        metadata: params.metadata,
      });

      if (created) {
        this.logger.log(`Created new user ${user.id} (${user.email})`);
      }

      return {
        token: session.plainToken,
        expiresAt: session.record.expiresAt,
        session: session.record,
        user,
      };
    });
  }

  async validateSessionToken(token: string): Promise<{
    session: Session;
    user: User;
  }> {
    const tokenHash = this.hashString(token);

    const session = await this.prisma.session.findFirst({
      where: {
        tokenHash,
        revokedAt: null,
        expiresAt: {
          gt: new Date(),
        },
      },
      include: {
        user: true,
      },
    });

    if (!session) {
      throw new UnauthorizedException('Invalid session token.');
    }

    await this.prisma.session.update({
      where: { id: session.id },
      data: { lastUsedAt: new Date() },
    });

    return {
      session,
      user: session.user,
    };
  }

  async revokeSession(sessionId: string): Promise<void> {
    await this.prisma.session.update({
      where: { id: sessionId },
      data: { revokedAt: new Date() },
    });
  }

  async loginWithFirebaseIdToken(params: {
    idToken: string;
    requestedRole?: UserRole;
    metadata?: {
      userAgent?: string;
      clientIp?: string;
    };
  }): Promise<AuthSession> {
    const sanitizedToken = params.idToken?.trim();

    if (!sanitizedToken) {
      throw new BadRequestException('Firebase ID token is required.');
    }

    let decodedToken: DecodedIdToken;

    try {
      decodedToken = await this.firebaseAdmin.verifyIdToken(sanitizedToken);
    } catch (error) {
      const reason =
        error instanceof Error ? error.message : 'Unknown verification error';
      this.logger.warn(`Failed to verify Firebase ID token: ${reason}`);
      throw new UnauthorizedException('Invalid Firebase ID token.');
    }

    const email = decodedToken.email;

    if (!email) {
      throw new UnauthorizedException(
        'Firebase account is missing a verified email address.',
      );
    }

    const normalizedEmail = this.normalizeEmail(email);
    const requestedRole = params.requestedRole ?? UserRole.CUSTOMER;

    return this.prisma.$transaction(async (tx) => {
      const { user, created } = await this.upsertFirebaseUserInTransaction(tx, {
        email: normalizedEmail,
        firebaseUid: decodedToken.uid,
        requestedRole,
      });

      await tx.user.update({
        where: { id: user.id },
        data: { lastSignedInAt: new Date() },
      });

      const session = await this.createSession(tx, {
        userId: user.id,
        metadata: params.metadata,
      });

      if (created) {
        this.logger.log(
          `Created new Firebase-backed user ${user.id} (${user.email})`,
        );
      }

      return {
        token: session.plainToken,
        expiresAt: session.record.expiresAt,
        session: session.record,
        user,
      };
    });
  }

  private normalizeEmail(email: string): string {
    if (!email) {
      throw new BadRequestException('Email is required.');
    }

    const trimmed = email.trim().toLowerCase();
    const emailRegex = /^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/i;

    if (!emailRegex.test(trimmed)) {
      throw new BadRequestException('Email is invalid.');
    }

    return trimmed;
  }

  private sanitizeOtpCode(code: string): string {
    if (!code) {
      throw new BadRequestException('OTP code is required.');
    }

    const trimmed = code.trim();

    if (!/^\d{6}$/.test(trimmed)) {
      throw new BadRequestException('OTP code is invalid.');
    }

    return trimmed;
  }

  private generateOtpCode(): string {
    const max = 10 ** OTP_CODE_LENGTH;
    return randomInt(0, max).toString().padStart(OTP_CODE_LENGTH, '0');
  }

  private hashString(value: string): string {
    return createHash('sha256').update(value).digest('hex');
  }

  private async upsertUserInTransaction(
    tx: Prisma.TransactionClient,
    email: string,
    requestedRole: UserRole,
  ): Promise<{ user: User; created: boolean }> {
    const existing = await tx.user.findUnique({ where: { email } });

    if (existing) {
      if (
        requestedRole === UserRole.ADMIN &&
        existing.role !== UserRole.ADMIN
      ) {
        this.logger.warn(
          `Attempt to self-assign ADMIN role via OTP for user ${existing.id}`,
        );
      }

      return { user: existing, created: false };
    }

    const roleToAssign =
      requestedRole === UserRole.ADMIN ? UserRole.CUSTOMER : requestedRole;

    const user = await tx.user.create({
      data: {
        email,
        role: roleToAssign,
      },
    });

    return { user, created: true };
  }

  private async upsertFirebaseUserInTransaction(
    tx: Prisma.TransactionClient,
    params: {
      email: string;
      firebaseUid: string;
      requestedRole: UserRole;
    },
  ): Promise<{ user: User; created: boolean }> {
    const existingByUid = await tx.user.findUnique({
      where: { firebaseUid: params.firebaseUid },
    });

    if (existingByUid) {
      if (existingByUid.email !== params.email) {
        const updated = await tx.user.update({
          where: { id: existingByUid.id },
          data: { email: params.email },
        });

        return { user: updated, created: false };
      }

      return { user: existingByUid, created: false };
    }

    const existingByEmail = await tx.user.findUnique({
      where: { email: params.email },
    });

    if (existingByEmail) {
      if (
        existingByEmail.firebaseUid &&
        existingByEmail.firebaseUid !== params.firebaseUid
      ) {
        this.logger.warn(
          `Attempt to relink Firebase UID ${params.firebaseUid} to user ${existingByEmail.id} already linked to ${existingByEmail.firebaseUid}. Keeping existing mapping.`,
        );
        return { user: existingByEmail, created: false };
      }

      const updated = await tx.user.update({
        where: { id: existingByEmail.id },
        data: { firebaseUid: params.firebaseUid },
      });

      return { user: updated, created: false };
    }

    const roleToAssign =
      params.requestedRole === UserRole.ADMIN
        ? UserRole.CUSTOMER
        : params.requestedRole;

    const user = await tx.user.create({
      data: {
        email: params.email,
        firebaseUid: params.firebaseUid,
        role: roleToAssign,
      },
    });

    return { user, created: true };
  }

  private async createSession(
    tx: Prisma.TransactionClient,
    params: {
      userId: string;
      metadata?: { userAgent?: string; clientIp?: string };
    },
  ): Promise<{ plainToken: string; record: Session }> {
    const plainToken = randomBytes(32).toString('hex');
    const tokenHash = this.hashString(plainToken);

    const record = await tx.session.create({
      data: {
        userId: params.userId,
        tokenHash,
        expiresAt: new Date(Date.now() + SESSION_TTL_SECONDS * 1000),
        userAgent: params.metadata?.userAgent,
        clientIp: params.metadata?.clientIp,
      },
    });

    return { plainToken, record };
  }
}
