import { Controller, Get, Param } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Public } from '../../common/decorators/public.decorator';
import { QRVerificationService } from './qr-verification.service';

@ApiTags('qr-verification')
@Controller('qr')
export class QRVerificationController {
  constructor(private readonly qrVerificationService: QRVerificationService) {}

  @Public()
  @Get('verify/:token')
  async verify(@Param('token') token: string) {
    try {
      return await this.qrVerificationService.verify(token);
    } catch {
      return this.qrVerificationService.verifySimulated(token);
    }
  }
}
