import { Module } from '@nestjs/common';
import { StorageModule } from '../storage/storage.module';
import { AthleteController } from './athlete.controller';
import { AthleteRepository } from './athlete.repository';
import { AthleteService } from './athlete.service';

@Module({
  imports: [StorageModule],
  controllers: [AthleteController],
  providers: [AthleteRepository, AthleteService],
  exports: [AthleteService, AthleteRepository],
})
export class AthleteModule {}
