import { Body, Controller, Get, Patch, Post, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { AuditAction } from '../../common/decorators/audit-action.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import type { AuthenticatedUser } from '../../common/interfaces/authenticated-request.interface';
import { AthleteService } from './athlete.service';
import { UpdateAthleteProfileDto } from './dto/update-athlete-profile.dto';
import { UploadDocumentDto } from './dto/upload-document.dto';

@ApiTags('athlete')
@ApiBearerAuth()
@Roles(UserRole.ATHLETE)
@Controller('athlete')
export class AthleteController {
  constructor(private readonly athleteService: AthleteService) {}

  @Get('profile')
  getProfile(@CurrentUser() user: AuthenticatedUser) {
    return this.athleteService.getProfile(user);
  }

  @Patch('profile')
  @AuditAction('athlete.profile.updated')
  updateProfile(@CurrentUser() user: AuthenticatedUser, @Body() dto: UpdateAthleteProfileDto) {
    return this.athleteService.updateProfile(user, dto);
  }

  @Post('documents')
  @AuditAction('athlete.document.uploaded')
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['documentType', 'file'],
      properties: {
        documentType: { type: 'string' },
        file: { type: 'string', format: 'binary' },
      },
    },
  })
  @UseInterceptors(FileInterceptor('file'))
  uploadDocument(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UploadDocumentDto,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.athleteService.uploadDocument(user, dto, file);
  }
}
