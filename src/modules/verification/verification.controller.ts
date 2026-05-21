import { Body, Controller, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { UserRole } from '@prisma/client';
import { AuditAction } from '../../common/decorators/audit-action.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import type { AuthenticatedUser } from '../../common/interfaces/authenticated-request.interface';
import { ApproveVerificationDto } from './dto/approve-verification.dto';
import { RejectVerificationDto } from './dto/reject-verification.dto';
import { RequestVerificationDto } from './dto/request-verification.dto';
import { VerificationService } from './verification.service';

@ApiTags('verification')
@ApiBearerAuth()
@Throttle({ default: { limit: 60, ttl: 60_000 } })
@Controller('verification')
export class VerificationController {
  constructor(private readonly verificationService: VerificationService) {}

  @Post('request')
  @AuditAction('verification.requested')
  @Roles(UserRole.ATHLETE, UserRole.COACH, UserRole.FEDERATION, UserRole.ADMIN)
  request(@CurrentUser() user: AuthenticatedUser, @Body() dto: RequestVerificationDto) {
    return this.verificationService.requestVerification(user, dto);
  }

  @Post('approve')
  @AuditAction('verification.approved')
  @Roles(UserRole.FEDERATION, UserRole.ADMIN)
  approve(@CurrentUser() user: AuthenticatedUser, @Body() dto: ApproveVerificationDto) {
    return this.verificationService.approve(user, dto);
  }

  @Post('reject')
  @AuditAction('verification.rejected')
  @Roles(UserRole.FEDERATION, UserRole.ADMIN)
  reject(@CurrentUser() user: AuthenticatedUser, @Body() dto: RejectVerificationDto) {
    return this.verificationService.reject(user, dto);
  }
}
