import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Job } from 'bullmq';
import { ReportStatus } from '@prisma/client';
import { AppEvents } from '../../common/constants/events';
import { QueueNames } from '../../common/constants/queues';
import { CryptoService } from '../../common/crypto/crypto.service';
import { PrismaService } from '../../prisma/prisma.service';
import { AiModerationService } from './ai-moderation.service';

interface ModerateReportJob {
  reportId: string;
}

@Injectable()
@Processor(QueueNames.AI_MODERATION)
export class AiModerationProcessor extends WorkerHost {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cryptoService: CryptoService,
    private readonly aiModerationService: AiModerationService,
    private readonly eventEmitter: EventEmitter2,
  ) {
    super();
  }

  async process(job: Job<ModerateReportJob>): Promise<void> {
    if (job.name !== 'report.moderate') {
      return;
    }

    const report = await this.prisma.abuseReport.findUnique({
      where: { id: job.data.reportId },
    });

    if (!report) {
      return;
    }

    const narrative = this.cryptoService.decryptString(
      report.narrativeCiphertext,
      report.narrativeIvBase64,
      report.narrativeAuthTagBase64,
    );
    const result = await this.aiModerationService.classifyReport(narrative);

    await this.prisma.$transaction([
      this.prisma.abuseReport.update({
        where: { id: report.id },
        data: {
          severity: result.severity,
          toxicityScore: result.toxicityScore,
          aiSummary: result.summary,
          status: report.status === ReportStatus.SUBMITTED ? ReportStatus.TRIAGED : report.status,
        },
      }),
      this.prisma.reportStatusHistory.create({
        data: {
          reportId: report.id,
          fromStatus: report.status,
          toStatus: report.status === ReportStatus.SUBMITTED ? ReportStatus.TRIAGED : report.status,
          reason: 'AI moderation classification completed',
          metadata: {
            severity: result.severity,
            toxicityScore: result.toxicityScore,
            repeatedIncidentHints: result.repeatedIncidentHints,
          },
        },
      }),
    ]);

    this.eventEmitter.emit(AppEvents.SEVERITY_CLASSIFIED, {
      reportId: report.id,
      severity: result.severity,
      toxicityScore: result.toxicityScore,
    });
  }
}
