import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { OtpMailerService } from '../src/auth/otp-mailer.service';
import { PrismaService } from '../src/prisma';

class FakeOtpMailerService {
  sent: Array<{ email: string; code: string }> = [];
  private health:
    | { status: 'up'; message?: string }
    | { status: 'down'; message: string } = { status: 'up' };

  async sendLoginCode(email: string, code: string): Promise<void> {
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
  let httpServer: any;

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
    httpServer = app.getHttpServer();
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

    expect(firstRequest.body).toEqual({
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
    expect(cooldownResponse.body.message).toBe(
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

    expect(verifyResponse.body.token).toEqual(expect.any(String));
    expect(verifyResponse.body.expiresAt).toEqual(expect.any(String));
    expect(verifyResponse.body.user).toMatchObject({
      email: email.toLowerCase(),
      role: 'VENDOR',
    });

    const token = verifyResponse.body.token as string;
    const authenticated = await request(httpServer)
      .get('/auth/me')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(authenticated.body).toMatchObject({
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
    expect(reusedCode.body.message).toBe('Invalid or expired code.');
  });
});
