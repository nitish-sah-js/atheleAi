import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AuditLogsRepository, CreateAuditLogInput } from './audit-logs.repository';

@Injectable()
export class AuditLogsService {
  private readonly logger = new Logger(AuditLogsService.name);

  constructor(private readonly repository: AuditLogsRepository) {}

  async record(input: CreateAuditLogInput): Promise<void> {
    try {
      await this.repository.create(input);
    } catch (error) {
      this.logger.error({ err: error, action: input.action }, 'Failed to write audit log');
    }
  }

  list(query: { take?: number; skip?: number; actorUserId?: string; resourceType?: string }) {
    return this.repository.list({
      take: Math.min(query.take ?? 50, 200),
      skip: query.skip ?? 0,
      actorUserId: query.actorUserId,
      resourceType: query.resourceType,
    });
  }

  metadata(value: Record<string, unknown>): Prisma.InputJsonObject {
    return value as Prisma.InputJsonObject;
  }
}
