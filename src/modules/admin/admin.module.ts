import { Module } from '@nestjs/common';
import { AbuseReportsModule } from '../abuse-reports/abuse-reports.module';
import { AuditLogsModule } from '../audit-logs/audit-logs.module';
import { AdminController } from './admin.controller';

@Module({
  imports: [AuditLogsModule, AbuseReportsModule],
  controllers: [AdminController],
})
export class AdminModule {}
