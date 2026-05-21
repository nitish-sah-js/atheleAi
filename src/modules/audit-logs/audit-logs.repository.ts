import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

export interface CreateAuditLogInput {
  actorUserId?: string;
  action: string;
  resourceType: string;
  resourceId?: string;
  ipAddress?: string;
  userAgent?: string;
  requestId?: string;
  metadata?: Prisma.InputJsonValue;
}

@Injectable()
export class AuditLogsRepository {
  constructor(private readonly prisma: PrismaService) {}

  create(input: CreateAuditLogInput) {
    return this.prisma.auditLog.create({
      data: {
        actorUserId: input.actorUserId,
        action: input.action,
        resourceType: input.resourceType,
        resourceId: input.resourceId,
        ipAddress: input.ipAddress,
        userAgent: input.userAgent,
        requestId: input.requestId,
        metadata: input.metadata ?? Prisma.JsonNull,
      },
    });
  }

  list(params: { take: number; skip: number; actorUserId?: string; resourceType?: string }) {
    return this.prisma.auditLog.findMany({
      where: {
        actorUserId: params.actorUserId,
        resourceType: params.resourceType,
      },
      orderBy: { createdAt: 'desc' },
      take: params.take,
      skip: params.skip,
    });
  }
}
