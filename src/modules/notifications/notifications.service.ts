import { InjectQueue } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import { NotificationType, Prisma } from '@prisma/client';
import { Queue } from 'bullmq';
import { QueueNames } from '../../common/constants/queues';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class NotificationsService {
  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue(QueueNames.NOTIFICATIONS) private readonly notificationsQueue: Queue,
  ) {}

  async enqueue(input: {
    userId: string;
    type: NotificationType;
    subject: string;
    body: string;
    metadata?: Record<string, unknown>;
  }) {
    const notification = await this.prisma.notification.create({
      data: {
        userId: input.userId,
        type: input.type,
        subject: input.subject,
        body: input.body,
        metadata: input.metadata as Prisma.InputJsonValue,
      },
    });

    await this.notificationsQueue.add('notification.deliver', { notificationId: notification.id });
    return notification;
  }
}
