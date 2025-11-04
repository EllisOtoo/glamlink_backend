import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { OtpMailerService } from '../src/auth/otp-mailer.service';
import { PrismaService } from '../src/prisma';

type HttpServer = Parameters<typeof request>[0];

const assertMessageBody = (body: unknown): { message: string } => {
  if (
    !body ||
    typeof body !== 'object' ||
    typeof (body as { message?: unknown }).message !== 'string'
  ) {
    throw new Error('Unexpected response payload.');
  }
  return body as { message: string };
};

const assertVerifyBody = (
  body: unknown,
): {
  token: string;
  expiresAt: string;
  user: { email: string; role: string };
} => {
  if (!body || typeof body !== 'object') {
    throw new Error('Unexpected verify response payload.');
  }

  const candidate = body as {
    token?: unknown;
    expiresAt?: unknown;
    user?: { email?: unknown; role?: unknown };
  };

  if (
    typeof candidate.token !== 'string' ||
    typeof candidate.expiresAt !== 'string' ||
    !candidate.user ||
    typeof candidate.user.email !== 'string' ||
    typeof candidate.user.role !== 'string'
  ) {
    throw new Error('Unexpected verify response payload.');
  }

  return {
    token: candidate.token,
    expiresAt: candidate.expiresAt,
    user: {
      email: candidate.user.email,
      role: candidate.user.role,
    },
  };
};

const assertUserBody = (body: unknown): { email: string; role: string } => {
  if (!body || typeof body !== 'object') {
    throw new Error('Unexpected user response payload.');
  }

  const candidate = body as { email?: unknown; role?: unknown };
  if (
    typeof candidate.email !== 'string' ||
    typeof candidate.role !== 'string'
  ) {
    throw new Error('Unexpected user response payload.');
  }

  return { email: candidate.email, role: candidate.role };
};

class FakeOtpMailerService {
  sent: Array<{ email: string; code: string }> = [];
  private health:
    | { status: 'up'; message?: string }
    | { status: 'down'; message: string } = { status: 'up' };

  sendLoginCode(email: string, code: string): void {
    this.sent.push({ email, code });
  }

  getMailerHealth():
    | { status: 'up'; message?: string }
    | { status: 'down'; message: string } {
    return this.health;
  }

  reset(): void {
    this.sent = [];
  }
}

describe('Auth Phase 1 Flows (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let mailer: FakeOtpMailerService;
  let httpServer: HttpServer;

  beforeAll(async () => {
    mailer = new FakeOtpMailerService();

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(OtpMailerService)
      .useValue(mailer)
      .compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    prisma = app.get(PrismaService);
    httpServer = app.getHttpServer() as HttpServer;
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    mailer.reset();
    await prisma.$transaction([
      prisma.session.deleteMany(),
      prisma.emailOtp.deleteMany(),
      prisma.vendorStatusHistory.deleteMany(),
      prisma.kycDocument.deleteMany(),
      prisma.vendor.deleteMany(),
      prisma.user.deleteMany(),
    ]);
  });

  it('completes the email OTP authentication lifecycle', async () => {
    const email = 'phase1.vendor@example.com';

    const firstRequest = await request(httpServer)
      .post('/auth/request-otp')
      .send({ email })
      .expect(202);

    const firstBody = assertMessageBody(firstRequest.body);
    expect(firstBody).toEqual({
      message: 'OTP sent if email exists.',
    });
    expect(mailer.sent).toHaveLength(1);
    const firstMail = mailer.sent.at(-1);
    expect(firstMail).toBeDefined();
    const otpCode = firstMail!.code;
    expect(firstMail!.email).toBe(email.toLowerCase());
    expect(otpCode).toHaveLength(6);

    const cooldownResponse = await request(httpServer)
      .post('/auth/request-otp')
      .send({ email })
      .expect(400);
    const cooldownBody = assertMessageBody(cooldownResponse.body);
    expect(cooldownBody.message).toBe(
      'OTP recently sent. Please wait before requesting another code.',
    );

    const verifyResponse = await request(httpServer)
      .post('/auth/verify-otp')
      .send({
        email,
        code: otpCode,
        role: 'VENDOR',
      })
      .expect(200);

    const verifyBody = assertVerifyBody(verifyResponse.body);

    expect(verifyBody.token).toEqual(expect.any(String));
    expect(verifyBody.expiresAt).toEqual(expect.any(String));
    expect(verifyBody.user).toMatchObject({
      email: email.toLowerCase(),
      role: 'VENDOR',
    });

    const token = verifyBody.token;
    const authenticated = await request(httpServer)
      .get('/auth/me')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    const authenticatedBody = assertUserBody(authenticated.body);
    expect(authenticatedBody).toMatchObject({
      email: email.toLowerCase(),
      role: 'VENDOR',
    });

    await request(httpServer)
      .post('/auth/logout')
      .set('Authorization', `Bearer ${token}`)
      .expect(204);

    await request(httpServer)
      .get('/auth/me')
      .set('Authorization', `Bearer ${token}`)
      .expect(401);

    const reusedCode = await request(httpServer)
      .post('/auth/verify-otp')
      .send({
        email,
        code: otpCode,
      })
      .expect(401);
    const reusedBody = assertMessageBody(reusedCode.body);
    expect(reusedBody.message).toBe('Invalid or expired code.');
  });
});
