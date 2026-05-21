import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { NotificationStatus } from '@prisma/client';
import { QueueNames } from '../../common/constants/queues';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
@Processor(QueueNames.NOTIFICATIONS)
export class NotificationsProcessor extends WorkerHost {
  private readonly logger = new Logger(NotificationsProcessor.name);

  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async process(job: Job<{ notificationId: string }>): Promise<void> {
    if (job.name !== 'notification.deliver') {
      return;
    }

    const notification = await this.prisma.notification.findUnique({
      where: { id: job.data.notificationId },
    });

    if (!notification) {
      return;
    }

    this.logger.log(
      {
        notificationId: notification.id,
        userId: notification.userId,
        type: notification.type,
      },
      'Notification delivery adapter placeholder',
    );

    await this.prisma.notification.update({
      where: { id: notification.id },
      data: {
        status: NotificationStatus.SENT,
        sentAt: new Date(),
      },
    });
  }
}
