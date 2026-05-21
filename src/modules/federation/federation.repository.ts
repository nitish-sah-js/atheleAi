import { Injectable } from '@nestjs/common';
import { FederationStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class FederationRepository {
  constructor(private readonly prisma: PrismaService) {}

  create(data: Prisma.FederationCreateInput) {
    return this.prisma.federation.create({ data });
  }

  findActiveById(id: string) {
    return this.prisma.federation.findFirst({
      where: { id, status: FederationStatus.ACTIVE, deletedAt: null },
      include: { memberships: true },
    });
  }

  list() {
    return this.prisma.federation.findMany({
      where: { deletedAt: null },
      orderBy: { name: 'asc' },
    });
  }
}
