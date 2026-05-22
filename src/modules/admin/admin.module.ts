import { Module } from '@nestjs/common';
import { AbuseReportsModule } from '../abuse-reports/abuse-reports.module';
import { AdminController } from './admin.controller';

@Module({
  imports: [AbuseReportsModule],
  controllers: [AdminController],
})
export class AdminModule {}
