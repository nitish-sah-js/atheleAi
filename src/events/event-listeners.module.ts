import { Module } from '@nestjs/common';
import { AuditLogsModule } from '../modules/audit-logs/audit-logs.module';
import { DomainEventAuditListener } from './domain-event-audit.listener';

@Module({
  imports: [AuditLogsModule],
  providers: [DomainEventAuditListener],
})
export class EventListenersModule {}
