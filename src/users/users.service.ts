import { Injectable } from '@nestjs/common';
import { Prisma, User as PrismaUser, UserRole } from '@prisma/client';
import { PrismaService } from '../prisma';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async findByEmail(email: string): Promise<PrismaUser | null> {
    return this.prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });
  }

  async findById(id: string): Promise<PrismaUser | null> {
    return this.prisma.user.findUnique({ where: { id } });
  }

  async create(email: string, role: UserRole): Promise<PrismaUser> {
    return this.prisma.user.create({
      data: {
        email: email.toLowerCase(),
        role,
      },
    });
  }

  async updateLastSignedInAt(userId: string): Promise<void> {
    await this.prisma.user.update({
      where: { id: userId },
      data: { lastSignedInAt: new Date() },
    });
  }

  async updateRole(userId: string, role: UserRole): Promise<PrismaUser> {
    return this.prisma.user.update({
      where: { id: userId },
      data: { role },
    });
  }

  async upsertUser(
    email: string,
    role: UserRole,
  ): Promise<{ user: PrismaUser; created: boolean }> {
    const lowerEmail = email.toLowerCase();
    const existing = await this.findByEmail(lowerEmail);

    if (existing) {
      return { user: existing, created: false };
    }

    const createdUser = await this.create(lowerEmail, role);
    return { user: createdUser, created: true };
  }

  async withTransaction<T>(
    fn: (tx: Prisma.TransactionClient) => Promise<T>,
  ): Promise<T> {
    return this.prisma.$transaction(fn);
  }
}
