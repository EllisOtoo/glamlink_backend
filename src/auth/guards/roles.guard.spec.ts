import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Session, User, UserRole } from '@prisma/client';
import { RolesGuard } from './roles.guard';
import { RequestWithAuth } from '../decorators/current-user.decorator';

describe('RolesGuard', () => {
  const reflector = new Reflector();
  let guard: RolesGuard;

  beforeEach(() => {
    guard = new RolesGuard(reflector);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('allows access when no roles are required', () => {
    jest
      .spyOn(reflector, 'getAllAndOverride')
      .mockReturnValueOnce(undefined as unknown as UserRole[]);

    const context = createContext({});

    expect(guard.canActivate(context)).toBe(true);
  });

  it('allows access when user role matches requirement', () => {
    jest
      .spyOn(reflector, 'getAllAndOverride')
      .mockReturnValueOnce([UserRole.ADMIN]);

    const request: Partial<RequestWithAuth> = {
      auth: {
        token: 't',
        session: createSession(),
        user: createUser(UserRole.ADMIN),
      },
    };

    const context = createContext(request);

    expect(guard.canActivate(context)).toBe(true);
  });

  it('denies access when user role not permitted', () => {
    jest
      .spyOn(reflector, 'getAllAndOverride')
      .mockReturnValueOnce([UserRole.ADMIN]);

    const request: Partial<RequestWithAuth> = {
      auth: {
        token: 't',
        session: createSession(),
        user: createUser(UserRole.CUSTOMER),
      },
    };

    const context = createContext(request);

    expect(guard.canActivate(context)).toBe(false);
  });
});

function createContext(request: Partial<RequestWithAuth>): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => request,
    }),
    getHandler: () => ({}),
    getClass: () => ({}),
  } as unknown as ExecutionContext;
}

function createSession(): Session {
  return {
    id: 'session-id',
    tokenHash: 'hash',
    userId: 'user-id',
    createdAt: new Date(),
    expiresAt: new Date(Date.now() + 3_600_000),
    revokedAt: null,
    lastUsedAt: null,
    userAgent: null,
    clientIp: null,
  };
}

function createUser(role: UserRole): User {
  return {
    id: 'user-id',
    email: role === UserRole.ADMIN ? 'admin@example.com' : 'user@example.com',
    firebaseUid: null,
    role,
    lastSignedInAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}
