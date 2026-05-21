import { Module } from '@nestjs/common';
import { FederationController } from './federation.controller';
import { FederationRepository } from './federation.repository';
import { FederationService } from './federation.service';

@Module({
  controllers: [FederationController],
  providers: [FederationRepository, FederationService],
  exports: [FederationService, FederationRepository],
})
export class FederationModule {}
