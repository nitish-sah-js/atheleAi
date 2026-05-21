import { Body, Controller, Get, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { Roles } from '../../common/decorators/roles.decorator';
import { CreateFederationDto } from './dto/create-federation.dto';
import { FederationService } from './federation.service';

@ApiTags('federation')
@ApiBearerAuth()
@Controller('federations')
export class FederationController {
  constructor(private readonly federationService: FederationService) {}

  @Get()
  @Roles(UserRole.ADMIN, UserRole.FEDERATION)
  list() {
    return this.federationService.list();
  }

  @Post()
  @Roles(UserRole.ADMIN)
  create(@Body() dto: CreateFederationDto) {
    return this.federationService.create(dto);
  }
}
