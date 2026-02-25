import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { Prisma, Session, User, UserRole, VendorStatus } from '@prisma/client';
import type { DecodedIdToken } from 'firebase-admin/auth';
import { randomBytes, randomInt, createHash } from 'node:crypto';
import { PrismaService } from '../prisma';
import { OtpMailerService } from './otp-mailer.service';
import { FirebaseAdminService } from '../firebase';
import { signJwt, verifyJwt } from './jwt.utils';

const OTP_CODE_LENGTH = 6;
const OTP_TTL_SECONDS = 5 * 60;
const OTP_RESEND_COOLDOWN_SECONDS = 60;
const OTP_MAX_ATTEMPTS = 5;
const SESSION_TTL_SECONDS = 30 * 24 * 60 * 60; // 30 days
const DEFAULT_JWT_TTL_SECONDS = 60 * 60; // 1 hour

export interface VendorContext {
  id: string;
  handle: string | null;
  status: VendorStatus;
  onboardingStep: number;
}

export interface AuthSession {
  token: string;
  expiresAt: Date;
  session: Session;
  user: User;
  vendor: VendorContext | null;
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

    return this.prisma.$transaction(
      async (tx) => {
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

        const session = await this.createSession(tx, {
          userId: user.id,
          metadata: params.metadata,
        });

        const vendor = await this.findVendorContext(tx, user.id);

        if (created) {
          this.logger.log(`Created new user ${user.id} (${user.email})`);
        }

        return {
          token: session.plainToken,
          expiresAt: session.record.expiresAt,
          session: session.record,
          user,
          vendor,
        };
      },
      { timeout: 20000 },
    );
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

  async validateJwtToken(token: string): Promise<{ user: User } | null> {
    const secret = this.getJwtSecret();
    try {
      const payload = verifyJwt(token, secret);
      const userId = String(payload.sub);
      const firebaseUid =
        typeof payload.firebaseUid === 'string' ? payload.firebaseUid : null;
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
      });
      if (!user) {
        return null;
      }
      if (firebaseUid && user.firebaseUid && user.firebaseUid !== firebaseUid) {
        return null;
      }
      return { user };
    } catch (error) {
      return null;
    }
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

    // Upsert the user OUTSIDE of the transaction.
    // PostgreSQL aborts the entire transaction on any error (e.g. P2002 unique constraint),
    // making recovery impossible inside the same tx. Running this step first, against the
    // main prisma client, guarantees a clean connection for the upsert.
    const { user } = await this.upsertFirebaseUser({
      email: normalizedEmail,
      firebaseUid: decodedToken.uid,
      requestedRole,
    });

    return this.prisma.$transaction(
      async (tx) => {
        const session = await this.createSession(tx, {
          userId: user.id,
          metadata: params.metadata,
        });

        const vendor = await this.findVendorContext(tx, user.id);

        return {
          token: session.plainToken,
          expiresAt: session.record.expiresAt,
          session: session.record,
          user,
          vendor,
        };
      },
      { timeout: 20000 },
    );
  }

  async registerWithFirebaseIdToken(params: {
    idToken: string;
    requestedRole?: UserRole;
    metadata?: { userAgent?: string; clientIp?: string };
  }): Promise<{
    access_token: string;
    expiresAt: Date;
    user: User;
    vendor: VendorContext | null;
  }> {
    const decoded = await this.verifyFirebaseIdToken(params.idToken);
    const normalizedEmail = this.normalizeEmail(decoded.email ?? '');
    const requestedRole = params.requestedRole ?? UserRole.CUSTOMER;

    const existing = await this.prisma.user.findFirst({
      where: {
        OR: [{ firebaseUid: decoded.uid }, { email: normalizedEmail }],
      },
    });

    if (existing) {
      throw new ConflictException('User already registered.');
    }

    const user = await this.prisma.user.create({
      data: {
        email: normalizedEmail,
        role: requestedRole,
        firebaseUid: decoded.uid,
        lastSignedInAt: new Date(),
      },
    });

    const vendor = await this.findVendorContext(this.prisma, user.id);
    const jwt = this.buildJwt(user, decoded, vendor);
    this.logger.log(`Registered Firebase user ${user.id} (${user.email})`);
    return jwt;
  }

  async loginWithFirebaseJwt(params: {
    idToken: string;
    requestedRole?: UserRole;
    metadata?: { userAgent?: string; clientIp?: string };
  }): Promise<{
    access_token: string;
    expiresAt: Date;
    user: User;
    vendor: VendorContext | null;
  }> {
    const decoded = await this.verifyFirebaseIdToken(params.idToken);

    const user = await this.prisma.user.findFirst({
      where: { firebaseUid: decoded.uid },
    });

    if (!user) {
      throw new NotFoundException('User not found.');
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastSignedInAt: new Date() },
    });

    const vendor = await this.findVendorContext(this.prisma, user.id);
    return this.buildJwt(user, decoded, vendor);
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

  private async verifyFirebaseIdToken(
    idToken: string,
  ): Promise<DecodedIdToken> {
    const sanitizedToken = idToken?.trim();

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

    if (!decodedToken.email) {
      throw new UnauthorizedException(
        'Firebase account is missing a verified email address.',
      );
    }

    return decodedToken;
  }

  private buildJwt(
    user: User,
    decodedToken: DecodedIdToken,
    vendor: VendorContext | null,
  ): {
    access_token: string;
    expiresAt: Date;
    user: User;
    vendor: VendorContext | null;
  } {
    const ttl = this.getJwtTtlSeconds();
    const exp = Math.floor(Date.now() / 1000) + ttl;
    const payload = {
      sub: user.id,
      firebaseUid: decodedToken.uid,
      email: user.email,
      phoneNumber: decodedToken.phone_number ?? null,
      role: user.role,
      vendorId: vendor?.id ?? null,
      vendorHandle: vendor?.handle ?? null,
      vendorStatus: vendor?.status ?? null,
      onboardingStep: vendor?.onboardingStep ?? 0,
      exp,
    };

    const token = signJwt(payload, this.getJwtSecret());
    return {
      access_token: token,
      expiresAt: new Date(exp * 1000),
      user,
      vendor,
    };
  }

  private getJwtSecret(): string {
    const secret = process.env.AUTH_JWT_SECRET;
    if (!secret) {
      this.logger.warn(
        'AUTH_JWT_SECRET not set. Falling back to insecure default. Set a strong secret in production.',
      );
      return 'change-me-in-production';
    }
    return secret;
  }

  private getJwtTtlSeconds(): number {
    const parsed = Number(process.env.AUTH_JWT_TTL_SECONDS);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      return DEFAULT_JWT_TTL_SECONDS;
    }
    return parsed;
  }

  async getVendorContextByUserId(
    userId: string,
  ): Promise<VendorContext | null> {
    return this.findVendorContext(this.prisma, userId);
  }

  private async findVendorContext(
    client: Prisma.TransactionClient | PrismaService,
    userId: string,
  ): Promise<VendorContext | null> {
    const vendor = await client.vendor.findUnique({
      where: { userId },
      select: {
        id: true,
        handle: true,
        status: true,
        onboardingStep: true,
      },
    });

    if (!vendor) {
      return null;
    }

    return {
      id: vendor.id,
      handle: vendor.handle,
      status: vendor.status,
      onboardingStep: vendor.onboardingStep ?? 0,
    };
  }

  async getCustomerProfile(userId: string): Promise<{ fullName: string | null; phoneNumber: string | null } | null> {
    const profile = await this.prisma.customerProfile.findUnique({
      where: { userId },
      select: {
        fullName: true,
        phoneNumber: true,
      },
    });

    if (!profile) {
      return null;
    }

    return profile;
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

      const data: Prisma.UserUpdateInput = { lastSignedInAt: new Date() };
      
      // Auto-upgrade CUSTOMER -> VENDOR
      if (requestedRole === UserRole.VENDOR && existing.role === UserRole.CUSTOMER) {
        data.role = UserRole.VENDOR;
      }

      const updated = await tx.user.update({
        where: { id: existing.id },
        data,
      });

      return { user: updated, created: false };
    }

    const roleToAssign =
      requestedRole === UserRole.ADMIN ? UserRole.CUSTOMER : requestedRole;

    const user = await tx.user.create({
      data: {
        email,
        role: roleToAssign,
        lastSignedInAt: new Date(),
      },
    });

    return { user, created: true };
  }

  /**
   * Upserts a Firebase-authenticated user against the main prisma client (NOT within a tx).
   * Must stay outside transactions because PostgreSQL aborts the entire tx on any error,
   * making recovery from P2002 unique-constraint violations impossible mid-transaction.
   */
  private async upsertFirebaseUser(params: {
    email: string;
    firebaseUid: string;
    requestedRole: UserRole;
  }): Promise<{ user: User; created: boolean }> {
    // 1. Look up by Firebase UID first
    const existingByUid = await this.prisma.user.findUnique({
      where: { firebaseUid: params.firebaseUid },
    });

    if (existingByUid) {
      const data: Prisma.UserUpdateInput = { lastSignedInAt: new Date() };

      if (existingByUid.email !== params.email) {
        data.email = params.email;
      }

      // Auto-upgrade CUSTOMER -> VENDOR
      if (params.requestedRole === UserRole.VENDOR && existingByUid.role === UserRole.CUSTOMER) {
        data.role = UserRole.VENDOR;
      }

      const updated = await this.prisma.user.update({
        where: { id: existingByUid.id },
        data,
      });

      return { user: updated, created: false };
    }

    // 2. Look up by email (case-insensitive) — covers users created via OTP or different flow
    const existingByEmail = await this.prisma.user.findFirst({
      where: { email: { equals: params.email, mode: 'insensitive' } },
    });

    if (existingByEmail) {
      const data: Prisma.UserUpdateInput = { lastSignedInAt: new Date() };

      if (
        existingByEmail.firebaseUid &&
        existingByEmail.firebaseUid !== params.firebaseUid
      ) {
        this.logger.warn(
          `Attempt to relink Firebase UID ${params.firebaseUid} to user ${existingByEmail.id} already linked to ${existingByEmail.firebaseUid}. Keeping existing mapping.`,
        );
      } else {
        data.firebaseUid = params.firebaseUid;
      }

      // Auto-upgrade CUSTOMER -> VENDOR
      if (params.requestedRole === UserRole.VENDOR && existingByEmail.role === UserRole.CUSTOMER) {
        data.role = UserRole.VENDOR;
      }

      const updated = await this.prisma.user.update({
        where: { id: existingByEmail.id },
        data,
      });

      return { user: updated, created: false };
    }

    // 3. New user — create
    const roleToAssign =
      params.requestedRole === UserRole.ADMIN
        ? UserRole.CUSTOMER
        : params.requestedRole;

    try {
      const user = await this.prisma.user.create({
        data: {
          email: params.email,
          firebaseUid: params.firebaseUid,
          role: roleToAssign,
          lastSignedInAt: new Date(),
        },
      });

      this.logger.log(`Created new Firebase-backed user ${user.id} (${user.email})`);
      return { user, created: true };
    } catch (err: any) {
      // P2002: unique constraint on email — user exists but our lookups missed them.
      // This can happen due to email normalization differences between Firebase and the DB.
      if (err?.code === 'P2002') {
        this.logger.warn(
          `P2002 on create for ${params.email} — falling back to find-and-update`,
        );
        const fallbackUser = await this.prisma.user.findUnique({
          where: { email: params.email },
        });

        if (fallbackUser) {
          const data: Prisma.UserUpdateInput = {
            lastSignedInAt: new Date(),
            firebaseUid: fallbackUser.firebaseUid ?? params.firebaseUid,
          };

          if (params.requestedRole === UserRole.VENDOR && fallbackUser.role === UserRole.CUSTOMER) {
            data.role = UserRole.VENDOR;
          }

          const updated = await this.prisma.user.update({
            where: { id: fallbackUser.id },
            data,
          });
          return { user: updated, created: false };
        }
      }
      throw err;
    }
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
