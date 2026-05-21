import { Controller, Get, Res } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Response } from 'express';
import { collectDefaultMetrics, register } from 'prom-client';
import { Public } from '../../common/decorators/public.decorator';

let metricsInitialized = false;

@ApiTags('metrics')
@Controller('metrics')
export class MetricsController {
  constructor() {
    if (!metricsInitialized) {
      collectDefaultMetrics();
      metricsInitialized = true;
    }
  }

  @Public()
  @Get()
  async metrics(@Res() response: Response) {
    response.setHeader('Content-Type', register.contentType);
    response.end(await register.metrics());
  }
}
