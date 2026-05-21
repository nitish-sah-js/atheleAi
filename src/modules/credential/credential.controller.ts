import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { AuditAction } from '../../common/decorators/audit-action.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import type { AuthenticatedUser } from '../../common/interfaces/authenticated-request.interface';
import { CredentialService } from './credential.service';
import { SignCredentialDto } from './dto/sign-credential.dto';

@ApiTags('credentials')
@ApiBearerAuth()
@Controller('credentials')
export class CredentialController {
  constructor(private readonly credentialService: CredentialService) {}

  @Get(':id')
  @AuditAction('credential.read')
  @Roles(UserRole.ATHLETE, UserRole.FEDERATION, UserRole.ADMIN)
  getCredential(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.credentialService.getCredential(id, user);
  }

  @Post('sign')
  @AuditAction('credential.signed')
  @Roles(UserRole.FEDERATION, UserRole.ADMIN)
  sign(@Body() dto: SignCredentialDto) {
    return this.credentialService.signExistingCredential(dto);
  }
}
