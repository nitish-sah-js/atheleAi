import { Module } from '@nestjs/common';
import { QRVerificationModule } from '../qr-verification/qr-verification.module';
import { CredentialController } from './credential.controller';
import { CredentialRepository } from './credential.repository';
import { CredentialService } from './credential.service';

@Module({
  imports: [QRVerificationModule],
  controllers: [CredentialController],
  providers: [CredentialRepository, CredentialService],
  exports: [CredentialService, CredentialRepository],
})
export class CredentialModule {}
