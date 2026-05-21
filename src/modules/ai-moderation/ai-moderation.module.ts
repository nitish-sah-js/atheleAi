import { HttpModule } from '@nestjs/axios';
import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { QueueNames } from '../../common/constants/queues';
import { AiModerationProcessor } from './ai-moderation.processor';
import { AiModerationService } from './ai-moderation.service';

@Module({
  imports: [HttpModule, BullModule.registerQueue({ name: QueueNames.AI_MODERATION })],
  providers: [AiModerationService, AiModerationProcessor],
  exports: [AiModerationService],
})
export class AiModerationModule {}
