import { Module } from '@nestjs/common';
import { QRVerificationController } from './qr-verification.controller';
import { QRVerificationService } from './qr-verification.service';

@Module({
  controllers: [QRVerificationController],
  providers: [QRVerificationService],
  exports: [QRVerificationService],
})
export class QRVerificationModule {}
