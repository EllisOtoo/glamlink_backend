import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class LocationsService {
  constructor(private prisma: PrismaService) {}

  async getRegions() {
    return this.prisma.region.findMany({
      orderBy: { name: 'asc' },
    });
  }

  async getCities(regionId?: string) {
    return this.prisma.city.findMany({
      where: regionId ? { regionId } : {},
      orderBy: { name: 'asc' },
    });
  }
}
