import { Global, Module } from '@nestjs/common';
import { RedisThrottlerStorageService } from './redis-throttler-storage.service';

@Global()
@Module({
  providers: [RedisThrottlerStorageService],
  exports: [RedisThrottlerStorageService],
})
export class RedisRateLimitModule {}
