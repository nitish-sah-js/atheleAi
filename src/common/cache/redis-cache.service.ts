import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

@Injectable()
export class RedisCacheService implements OnModuleDestroy {
  private readonly logger = new Logger(RedisCacheService.name);
  private readonly client: Redis | null;

  constructor(configService: ConfigService) {
    const url = configService.get<string>('REDIS_URL');
    if (!url) {
      this.client = null;
      this.logger.warn('Redis disabled: no REDIS_URL configured');
      return;
    }
    this.client = new Redis(url, {
      maxRetriesPerRequest: 1,
      reconnectOnError: () => false,
      lazyConnect: true,
    });
  }

  async getJson<T>(key: string): Promise<T | undefined> {
    if (!this.client) return undefined;
    try {
      const value = await this.client.get(key);
      return value ? (JSON.parse(value) as T) : undefined;
    } catch (err) {
      this.logger.warn({ err }, 'Redis get failed');
      return undefined;
    }
  }

  async setJson(key: string, value: unknown, ttlSeconds: number): Promise<void> {
    if (!this.client) return;
    try {
      await this.client.set(key, JSON.stringify(value), 'EX', ttlSeconds);
    } catch {}
  }

  async del(key: string): Promise<void> {
    if (!this.client) return;
    try {
      await this.client.del(key);
    } catch {}
  }

  async onModuleDestroy(): Promise<void> {
    if (this.client) {
      await this.client.quit().catch(() => {});
    }
  }
}
