import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Public } from '../../common/decorators/public.decorator';
import { FederationService } from './federation.service';

@ApiTags('federation')
@Controller('federations')
export class FederationController {
  constructor(private readonly federationService: FederationService) {}

  @Public()
  @Get()
  list() {
    return this.federationService.list();
  }
}
