import { Injectable } from '@nestjs/common';
import { Prisma, VerificationRequestStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class VerificationRepository {
  constructor(private readonly prisma: PrismaService) {}

  createRequest(data: Prisma.VerificationRequestCreateInput) {
    return this.prisma.verificationRequest.create({
      data,
      include: { claims: true },
    });
  }

  findRequest(id: string) {
    return this.prisma.verificationRequest.findFirst({
      where: { id, deletedAt: null },
      include: {
        claims: true,
        federation: true,
        athleteProfile: true,
      },
    });
  }

  updateStatus(id: string, status: VerificationRequestStatus) {
    return this.prisma.verificationRequest.update({
      where: { id },
      data: { status },
    });
  }
}
