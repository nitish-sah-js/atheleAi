import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ThrottlerStorage } from '@nestjs/throttler';
import type { ThrottlerStorageRecord } from '@nestjs/throttler/dist/throttler-storage-record.interface';
import Redis from 'ioredis';

@Injectable()
export class RedisThrottlerStorageService implements ThrottlerStorage, OnModuleDestroy {
  private readonly client: Redis;

  constructor(configService: ConfigService) {
    this.client = new Redis(configService.getOrThrow<string>('REDIS_URL'), {
      maxRetriesPerRequest: 3,
      enableReadyCheck: true,
    });
  }

  async increment(
    key: string,
    ttl: number,
    limit: number,
    blockDuration: number,
    throttlerName: string,
  ): Promise<ThrottlerStorageRecord> {
    const counterKey = `throttle:${throttlerName}:${key}`;
    const blockKey = `throttle:${throttlerName}:blocked:${key}`;
    const normalizedTtl = Math.max(ttl, 1);
    const normalizedBlockDuration = Math.max(blockDuration || ttl, normalizedTtl);

    const blocked = await this.client.get(blockKey);

    if (blocked) {
      return {
        totalHits: limit + 1,
        timeToExpire: Math.max(await this.client.pttl(counterKey), 0),
        isBlocked: true,
        timeToBlockExpire: Math.max(await this.client.pttl(blockKey), 0),
      };
    }

    const totalHits = await this.client.incr(counterKey);

    if (totalHits === 1) {
      await this.client.pexpire(counterKey, normalizedTtl);
    }

    const timeToExpire = Math.max(await this.client.pttl(counterKey), 0);

    if (totalHits > limit) {
      await this.client.set(blockKey, '1', 'PX', normalizedBlockDuration, 'NX');

      return {
        totalHits,
        timeToExpire,
        isBlocked: true,
        timeToBlockExpire: Math.max(await this.client.pttl(blockKey), 0),
      };
    }

    return {
      totalHits,
      timeToExpire,
      isBlocked: false,
      timeToBlockExpire: 0,
    };
  }

  async onModuleDestroy(): Promise<void> {
    await this.client.quit();
  }
}
