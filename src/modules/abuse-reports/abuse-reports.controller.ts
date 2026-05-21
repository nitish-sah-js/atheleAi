import { Body, Controller, Get, Param, Post, Req, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBody, ApiConsumes, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Public } from '../../common/decorators/public.decorator';
import type { AuthenticatedRequest } from '../../common/interfaces/authenticated-request.interface';
import { getClientContext } from '../../common/utils/client-context';
import { AbuseReportsService } from './abuse-reports.service';
import { SubmitAnonymousReportDto } from './dto/submit-anonymous-report.dto';

@ApiTags('reports')
@Throttle({ default: { limit: 8, ttl: 60_000 } })
@Controller('reports')
export class AbuseReportsController {
  constructor(private readonly abuseReportsService: AbuseReportsService) {}

  @Public()
  @Post('anonymous')
  submitAnonymous(@Body() dto: SubmitAnonymousReportDto, @Req() request: AuthenticatedRequest) {
    return this.abuseReportsService.submitAnonymous(dto, getClientContext(request));
  }

  @Public()
  @Get(':id/status')
  getStatus(@Param('id') id: string) {
    return this.abuseReportsService.getStatus(id);
  }

  @Public()
  @Post(':id/evidence')
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file'],
      properties: {
        file: { type: 'string', format: 'binary' },
      },
    },
  })
  @UseInterceptors(FileInterceptor('file'))
  addEvidence(@Param('id') id: string, @UploadedFile() file: Express.Multer.File) {
    return this.abuseReportsService.addEvidence(id, file);
  }
}
