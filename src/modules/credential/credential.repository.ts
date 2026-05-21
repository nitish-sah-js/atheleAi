import { Injectable } from '@nestjs/common';
import { CredentialStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class CredentialRepository {
  constructor(private readonly prisma: PrismaService) {}

  findById(id: string) {
    return this.prisma.credential.findFirst({
      where: { id, deletedAt: null },
      include: {
        claims: true,
        athleteProfile: {
          select: {
            id: true,
            athleteCode: true,
            userId: true,
            primarySport: true,
          },
        },
        federation: true,
      },
    });
  }

  createSigned(data: Prisma.CredentialCreateInput) {
    return this.prisma.credential.create({
      data,
      include: { claims: true },
    });
  }

  updateSignature(id: string, data: Prisma.CredentialUpdateInput) {
    return this.prisma.credential.update({
      where: { id },
      data: {
        ...data,
        status: CredentialStatus.SIGNED,
      },
      include: { claims: true },
    });
  }
}
