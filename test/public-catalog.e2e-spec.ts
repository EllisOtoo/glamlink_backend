import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { randomBytes, createHash } from 'node:crypto';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma';

type HttpServer = Parameters<typeof request>[0];

describe('Public Catalog (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let httpServer: HttpServer;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    prisma = app.get(PrismaService);
    httpServer = app.getHttpServer() as HttpServer;
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    await prisma.$transaction([
      prisma.session.deleteMany(),
      prisma.serviceSeatService.deleteMany(),
      prisma.serviceSeat.deleteMany(),
      prisma.serviceImage.deleteMany(),
      prisma.service.deleteMany(),
      prisma.vendorStatusHistory.deleteMany(),
      prisma.kycDocument.deleteMany(),
      prisma.vendor.deleteMany(),
      prisma.review.deleteMany(),
      prisma.emailOtp.deleteMany(),
      prisma.user.deleteMany(),
    ]);
  });

  it('returns only the authenticated vendor services via /public/catalog/services/me', async () => {
    const vendorA = await seedVendorWithService(prisma, {
      businessName: 'Vendor A',
      handle: 'vendor-a',
      email: 'vendor-a@example.com',
      serviceName: 'Service A',
    });
    await seedVendorWithService(prisma, {
      businessName: 'Vendor B',
      handle: 'vendor-b',
      email: 'vendor-b@example.com',
      serviceName: 'Service B',
    });

    const response = await request(httpServer)
      .get('/public/catalog/services/me')
      .set('Authorization', `Bearer ${vendorA.token}`)
      .expect(200);

    expect(Array.isArray(response.body)).toBe(true);
    const ids = (response.body as Array<{ id?: string }>).map(
      (service) => service.id,
    );
    expect(ids).toEqual([vendorA.service.id]);
    const [service] = response.body as Array<{
      vendor?: { id?: string; businessName?: string };
    }>;
    expect(service.vendor?.id).toBe(vendorA.vendor.id);
  });

  it('denies unauthenticated access to /public/catalog/services/me', async () => {
    await request(httpServer)
      .get('/public/catalog/services/me')
      .expect(401);
  });

  it('keeps the public discover endpoint showing all vendors to guests', async () => {
    const vendorA = await seedVendorWithService(prisma, {
      businessName: 'Vendor A',
      handle: 'vendor-a',
      email: 'vendor-a@example.com',
      serviceName: 'Service A',
    });
    const vendorB = await seedVendorWithService(prisma, {
      businessName: 'Vendor B',
      handle: 'vendor-b',
      email: 'vendor-b@example.com',
      serviceName: 'Service B',
    });

    const response = await request(httpServer)
      .get('/public/catalog/services/discover')
      .expect(200);

    const ids = (response.body as Array<{ id?: string }>).map(
      (service) => service.id,
    );
    expect(ids).toEqual(
      expect.arrayContaining([vendorA.service.id, vendorB.service.id]),
    );
  });
});

async function seedVendorWithService(
  prisma: PrismaService,
  params: {
    businessName: string;
    handle: string;
    email: string;
    serviceName: string;
  },
): Promise<{
  user: { id: string };
  vendor: { id: string };
  service: { id: string };
  token: string;
}> {
  const user = await prisma.user.create({
    data: {
      email: params.email.toLowerCase(),
      role: 'VENDOR',
    },
  });

  const vendor = await prisma.vendor.create({
    data: {
      userId: user.id,
      businessName: params.businessName,
      handle: params.handle,
      status: 'VERIFIED',
    },
  });

  const service = await prisma.service.create({
    data: {
      vendorId: vendor.id,
      name: params.serviceName,
      priceCents: 1000,
      durationMinutes: 60,
    },
  });

  const token = randomBytes(16).toString('hex');
  const tokenHash = createHash('sha256').update(token).digest('hex');

  await prisma.session.create({
    data: {
      userId: user.id,
      tokenHash,
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    },
  });

  return { user, vendor, service, token };
}
