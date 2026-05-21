import { InjectQueue } from '@nestjs/bullmq';
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ReportEvidenceType, ReportStatus, UserRole, UserStatus } from '@prisma/client';
import { Queue } from 'bullmq';
import { AppEvents } from '../../common/constants/events';
import { QueueNames } from '../../common/constants/queues';
import { CryptoService } from '../../common/crypto/crypto.service';
import type { ClientContext } from '../../common/utils/client-context';
import { PrismaService } from '../../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { AbuseReportsRepository } from './abuse-reports.repository';
import { SubmitAnonymousReportDto } from './dto/submit-anonymous-report.dto';

@Injectable()
export class AbuseReportsService {
  constructor(
    private readonly repository: AbuseReportsRepository,
    private readonly prisma: PrismaService,
    private readonly cryptoService: CryptoService,
    private readonly storageService: StorageService,
    private readonly eventEmitter: EventEmitter2,
    @InjectQueue(QueueNames.AI_MODERATION) private readonly aiQueue: Queue,
  ) {}

  async submitAnonymous(dto: SubmitAnonymousReportDto, context: ClientContext) {
    const narrative = this.cryptoService.encryptString(dto.narrative);
    const reporterContact = dto.reporterContact
      ? this.cryptoService.encryptString(dto.reporterContact)
      : undefined;
    const publicTrackingId = this.createPublicTrackingId();

    const report = await this.repository.createAnonymousReport({
      publicTrackingId,
      title: dto.title,
      subjectAthlete: dto.subjectAthleteId
        ? { connect: { id: dto.subjectAthleteId } }
        : undefined,
      narrativeCiphertext: narrative.ciphertextBase64,
      narrativeIvBase64: narrative.ivBase64,
      narrativeAuthTagBase64: narrative.authTagBase64,
      narrativeHashSha256: this.cryptoService.sha256(dto.narrative),
      reporterContactCiphertext: reporterContact?.ciphertextBase64,
      reporterContactIvBase64: reporterContact?.ivBase64,
      reporterContactAuthTagBase64: reporterContact?.authTagBase64,
      submittedIpHash: context.ipAddress ? this.cryptoService.sha256(context.ipAddress) : undefined,
      userAgentHash: context.userAgent ? this.cryptoService.sha256(context.userAgent) : undefined,
      statusHistory: {
        create: {
          toStatus: ReportStatus.SUBMITTED,
          reason: 'Anonymous report submitted',
        },
      },
    });

    await this.aiQueue.add(
      'report.moderate',
      { reportId: report.id },
      {
        attempts: 3,
        backoff: { type: 'exponential', delay: 5_000 },
        removeOnComplete: true,
        removeOnFail: 100,
      },
    );

    this.eventEmitter.emit(AppEvents.ABUSE_REPORT_SUBMITTED, {
      reportId: report.id,
      publicTrackingId,
      subjectAthleteId: dto.subjectAthleteId,
    });

    return {
      trackingId: publicTrackingId,
      status: report.status,
      severity: report.severity,
      createdAt: report.createdAt,
    };
  }

  async getStatus(id: string) {
    const report = await this.repository.findByPublicIdOrId(id);

    if (!report) {
      throw new NotFoundException('Report not found');
    }

    return {
      trackingId: report.publicTrackingId,
      status: report.status,
      severity: report.severity,
      createdAt: report.createdAt,
      updatedAt: report.updatedAt,
    };
  }

  async addEvidence(id: string, file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('Evidence file is missing');
    }

    const report = await this.repository.findByPublicIdOrId(id);

    if (!report) {
      throw new NotFoundException('Report not found');
    }

    const object = await this.storageService.uploadEncryptedFile({
      buffer: file.buffer,
      originalFileName: file.originalname,
      mimeType: file.mimetype,
      keyPrefix: `reports/${report.id}/evidence`,
    });

    const evidence = await this.repository.createEvidence({
      reportId: report.id,
      evidenceType: this.inferEvidenceType(file.mimetype),
      object,
    });

    return {
      id: evidence.id,
      evidenceType: evidence.evidenceType,
      createdAt: evidence.createdAt,
    };
  }

  listOpenReports() {
    return this.repository.listOpenReports();
  }

  async assignReport(params: {
    reportId: string;
    investigatorUserId: string;
    changedByUserId: string;
  }) {
    const report = await this.repository.findByPublicIdOrId(params.reportId);

    if (!report) {
      throw new NotFoundException('Report not found');
    }

    const investigator = await this.prisma.user.findFirst({
      where: {
        id: params.investigatorUserId,
        roles: { has: UserRole.INVESTIGATOR },
        status: UserStatus.ACTIVE,
        deletedAt: null,
      },
      select: { id: true },
    });

    if (!investigator) {
      throw new NotFoundException('Investigator not found');
    }

    await this.prisma.$transaction([
      this.prisma.abuseReport.update({
        where: { id: report.id },
        data: {
          assignedToUserId: investigator.id,
          status: ReportStatus.ASSIGNED,
        },
      }),
      this.prisma.reportStatusHistory.create({
        data: {
          reportId: report.id,
          changedByUserId: params.changedByUserId,
          fromStatus: report.status,
          toStatus: ReportStatus.ASSIGNED,
          reason: 'Investigator assigned',
        },
      }),
    ]);

    return { success: true };
  }

  async updateStatus(params: {
    reportId: string;
    status: ReportStatus;
    reason?: string;
    changedByUserId: string;
  }) {
    const report = await this.repository.findByPublicIdOrId(params.reportId);

    if (!report) {
      throw new NotFoundException('Report not found');
    }

    await this.prisma.$transaction([
      this.prisma.abuseReport.update({
        where: { id: report.id },
        data: { status: params.status },
      }),
      this.prisma.reportStatusHistory.create({
        data: {
          reportId: report.id,
          changedByUserId: params.changedByUserId,
          fromStatus: report.status,
          toStatus: params.status,
          reason: params.reason,
        },
      }),
    ]);

    return { success: true };
  }

  private createPublicTrackingId(): string {
    return `ASR-${this.cryptoService.randomToken(8).replace(/[^a-zA-Z0-9]/g, '').toUpperCase()}`;
  }

  private inferEvidenceType(mimeType: string): ReportEvidenceType {
    if (mimeType.startsWith('image/')) {
      return ReportEvidenceType.IMAGE;
    }

    if (mimeType.startsWith('video/')) {
      return ReportEvidenceType.VIDEO;
    }

    if (mimeType.startsWith('audio/')) {
      return ReportEvidenceType.AUDIO;
    }

    return ReportEvidenceType.DOCUMENT;
  }
}
