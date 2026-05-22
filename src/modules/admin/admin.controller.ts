import { Body, Controller, Get, Param, Patch } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { Roles } from '../../common/decorators/roles.decorator';
import { AbuseReportsService } from '../abuse-reports/abuse-reports.service';
import { UpdateReportStatusDto } from './dto/update-report-status.dto';

@ApiTags('admin')
@ApiBearerAuth()
@Controller('admin')
export class AdminController {
  constructor(private readonly abuseReportsService: AbuseReportsService) {}

  @Get('reports')
  @Roles(UserRole.ADMIN, UserRole.INVESTIGATOR)
  getReports() {
    return this.abuseReportsService.listOpenReports();
  }

  @Patch('reports/:id/status')
  @Roles(UserRole.ADMIN, UserRole.INVESTIGATOR)
  updateReportStatus(@Param('id') id: string, @Body() dto: UpdateReportStatusDto) {
    return this.abuseReportsService.updateStatus({
      reportId: id,
      status: dto.status,
      reason: dto.reason,
      changedByUserId: 'simulation',
    });
  }
}
