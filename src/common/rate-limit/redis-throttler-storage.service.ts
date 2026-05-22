import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ThrottlerStorage } from '@nestjs/throttler';
import type { ThrottlerStorageRecord } from '@nestjs/throttler/dist/throttler-storage-record.interface';
import Redis from 'ioredis';

@Injectable()
export class RedisThrottlerStorageService implements ThrottlerStorage, OnModuleDestroy {
  private readonly logger = new Logger(RedisThrottlerStorageService.name);
  private readonly client: Redis | null;

  constructor(configService: ConfigService) {
    const url = configService.get<string>('REDIS_URL');
    if (!url) {
      this.client = null;
      this.logger.warn('Rate limiting disabled: no REDIS_URL configured');
      return;
    }
    this.client = new Redis(url, {
      maxRetriesPerRequest: 1,
      reconnectOnError: () => false,
      lazyConnect: true,
    });
  }

  async increment(
    key: string,
    ttl: number,
    limit: number,
    blockDuration: number,
    throttlerName: string,
  ): Promise<ThrottlerStorageRecord> {
    if (!this.client) {
      return { totalHits: 0, timeToExpire: 0, isBlocked: false, timeToBlockExpire: 0 };
    }

    try {
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
    } catch (err) {
      this.logger.warn({ err }, 'Rate limit check failed, allowing request');
      return { totalHits: 0, timeToExpire: 0, isBlocked: false, timeToBlockExpire: 0 };
    }
  }

  async onModuleDestroy(): Promise<void> {
    if (this.client) {
      await this.client.quit().catch(() => {});
    }
  }
}
