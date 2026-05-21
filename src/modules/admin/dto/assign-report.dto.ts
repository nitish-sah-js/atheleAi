import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';

export class AssignReportDto {
  @ApiProperty()
  @IsUUID()
  investigatorUserId: string;
}
