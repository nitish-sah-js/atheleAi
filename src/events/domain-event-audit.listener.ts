import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { AppEvents } from '../common/constants/events';
import { AuditLogsService } from '../modules/audit-logs/audit-logs.service';

@Injectable()
export class DomainEventAuditListener {
  constructor(private readonly auditLogsService: AuditLogsService) {}

  @OnEvent(AppEvents.ATHLETE_REGISTERED)
  onAthleteRegistered(payload: Record<string, unknown>) {
    return this.record(AppEvents.ATHLETE_REGISTERED, 'AthleteProfile', payload);
  }

  @OnEvent(AppEvents.DOCUMENT_UPLOADED)
  onDocumentUploaded(payload: Record<string, unknown>) {
    return this.record(AppEvents.DOCUMENT_UPLOADED, 'UploadedDocument', payload);
  }

  @OnEvent(AppEvents.VERIFICATION_REQUESTED)
  onVerificationRequested(payload: Record<string, unknown>) {
    return this.record(AppEvents.VERIFICATION_REQUESTED, 'VerificationRequest', payload);
  }

  @OnEvent(AppEvents.VERIFICATION_APPROVED)
  onVerificationApproved(payload: Record<string, unknown>) {
    return this.record(AppEvents.VERIFICATION_APPROVED, 'VerificationRequest', payload);
  }

  @OnEvent(AppEvents.CREDENTIAL_SIGNED)
  onCredentialSigned(payload: Record<string, unknown>) {
    return this.record(AppEvents.CREDENTIAL_SIGNED, 'Credential', payload);
  }

  @OnEvent(AppEvents.QR_GENERATED)
  onQrGenerated(payload: Record<string, unknown>) {
    return this.record(AppEvents.QR_GENERATED, 'QRSession', payload);
  }

  @OnEvent(AppEvents.ABUSE_REPORT_SUBMITTED)
  onAbuseReportSubmitted(payload: Record<string, unknown>) {
    return this.record(AppEvents.ABUSE_REPORT_SUBMITTED, 'AbuseReport', payload);
  }

  @OnEvent(AppEvents.SEVERITY_CLASSIFIED)
  onSeverityClassified(payload: Record<string, unknown>) {
    return this.record(AppEvents.SEVERITY_CLASSIFIED, 'AbuseReport', payload);
  }

  private record(action: string, resourceType: string, payload: Record<string, unknown>) {
    return this.auditLogsService.record({
      action,
      resourceType,
      resourceId: this.inferResourceId(payload),
      metadata: this.auditLogsService.metadata(payload),
    });
  }

  private inferResourceId(payload: Record<string, unknown>): string | undefined {
    const candidate =
      payload.credentialId ??
      payload.documentId ??
      payload.verificationRequestId ??
      payload.reportId ??
      payload.qrSessionId ??
      payload.athleteProfileId;

    return typeof candidate === 'string' ? candidate : undefined;
  }
}
