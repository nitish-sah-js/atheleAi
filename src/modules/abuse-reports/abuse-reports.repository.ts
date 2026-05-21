import { Injectable } from '@nestjs/common';
import { Prisma, ReportEvidenceType, ReportStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import type { StoredEncryptedObject } from '../storage/storage.service';

@Injectable()
export class AbuseReportsRepository {
  constructor(private readonly prisma: PrismaService) {}

  createAnonymousReport(data: Prisma.AbuseReportCreateInput) {
    return this.prisma.abuseReport.create({
      data,
      include: { statusHistory: true },
    });
  }

  findByPublicIdOrId(id: string) {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const conditions: Prisma.AbuseReportWhereInput[] = [{ publicTrackingId: id }];
    if (uuidRegex.test(id)) {
      conditions.push({ id });
    }
    return this.prisma.abuseReport.findFirst({
      where: {
        OR: conditions,
        deletedAt: null,
      },
    });
  }

  listOpenReports() {
    return this.prisma.abuseReport.findMany({
      where: {
        status: {
          notIn: [ReportStatus.CLOSED, ReportStatus.RESOLVED],
        },
        deletedAt: null,
      },
      select: {
        id: true,
        publicTrackingId: true,
        subjectAthleteId: true,
        assignedToUserId: true,
        status: true,
        severity: true,
        title: true,
        aiSummary: true,
        toxicityScore: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: [{ severity: 'desc' }, { createdAt: 'desc' }],
      take: 100,
    });
  }

  createEvidence(input: {
    reportId: string;
    evidenceType: ReportEvidenceType;
    object: StoredEncryptedObject;
  }) {
    return this.prisma.reportEvidence.create({
      data: {
        reportId: input.reportId,
        evidenceType: input.evidenceType,
        originalFileName: input.object.originalFileName,
        mimeType: input.object.mimeType,
        sizeBytes: input.object.sizeBytes,
        checksumSha256: input.object.checksumSha256,
        s3Bucket: input.object.s3Bucket,
        s3Key: input.object.s3Key,
        encryptionAlgorithm: input.object.encryptionAlgorithm,
        encryptionIvBase64: input.object.encryptionIvBase64,
        encryptionAuthTagBase64: input.object.encryptionAuthTagBase64,
        encryptionKeyVersion: input.object.encryptionKeyVersion,
      },
    });
  }
}
