import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { QueueNames } from '../../common/constants/queues';
import { StorageModule } from '../storage/storage.module';
import { AbuseReportsController } from './abuse-reports.controller';
import { AbuseReportsRepository } from './abuse-reports.repository';
import { AbuseReportsService } from './abuse-reports.service';

@Module({
  imports: [StorageModule, BullModule.registerQueue({ name: QueueNames.AI_MODERATION })],
  controllers: [AbuseReportsController],
  providers: [AbuseReportsRepository, AbuseReportsService],
  exports: [AbuseReportsService, AbuseReportsRepository],
})
export class AbuseReportsModule {}
