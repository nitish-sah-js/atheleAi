import { Body, Controller, Get, Param, Patch, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { AuditAction } from '../../common/decorators/audit-action.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import type { AuthenticatedUser } from '../../common/interfaces/authenticated-request.interface';
import { AbuseReportsService } from '../abuse-reports/abuse-reports.service';
import { AuditLogQueryDto } from '../audit-logs/dto/audit-log-query.dto';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { AssignReportDto } from './dto/assign-report.dto';
import { UpdateReportStatusDto } from './dto/update-report-status.dto';

@ApiTags('admin')
@ApiBearerAuth()
@Controller('admin')
export class AdminController {
  constructor(
    private readonly auditLogsService: AuditLogsService,
    private readonly abuseReportsService: AbuseReportsService,
  ) {}

  @Get('audit-logs')
  @AuditAction('admin.audit_logs.read')
  @Roles(UserRole.ADMIN)
  getAuditLogs(@Query() query: AuditLogQueryDto) {
    return this.auditLogsService.list(query);
  }

  @Get('reports')
  @AuditAction('admin.reports.read')
  @Roles(UserRole.ADMIN, UserRole.INVESTIGATOR)
  getReports() {
    return this.abuseReportsService.listOpenReports();
  }

  @Patch('reports/:id/assign')
  @AuditAction('admin.report.assigned')
  @Roles(UserRole.ADMIN)
  assignReport(
    @Param('id') id: string,
    @Body() dto: AssignReportDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.abuseReportsService.assignReport({
      reportId: id,
      investigatorUserId: dto.investigatorUserId,
      changedByUserId: user.id,
    });
  }

  @Patch('reports/:id/status')
  @AuditAction('admin.report.status_updated')
  @Roles(UserRole.ADMIN, UserRole.INVESTIGATOR)
  updateReportStatus(
    @Param('id') id: string,
    @Body() dto: UpdateReportStatusDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.abuseReportsService.updateStatus({
      reportId: id,
      status: dto.status,
      reason: dto.reason,
      changedByUserId: user.id,
    });
  }
}
