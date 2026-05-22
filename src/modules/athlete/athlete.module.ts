import { Module } from '@nestjs/common';
import { RedisCacheModule } from '../../common/cache/redis-cache.module';
import { CryptoModule } from '../../common/crypto/crypto.module';
import { StorageModule } from '../storage/storage.module';
import { AthleteController } from './athlete.controller';
import { AthleteRepository } from './athlete.repository';
import { AthleteService } from './athlete.service';

@Module({
  imports: [StorageModule, RedisCacheModule, CryptoModule],
  controllers: [AthleteController],
  providers: [AthleteRepository, AthleteService],
  exports: [AthleteService, AthleteRepository],
})
export class AthleteModule {}
