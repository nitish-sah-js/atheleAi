import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsString, IsUUID, ValidateNested } from 'class-validator';
import { VerificationClaimDto } from './verification-claim.dto';

export class RequestVerificationDto {
  @ApiProperty()
  @IsUUID()
  athleteProfileId: string;

  @ApiProperty()
  @IsUUID()
  federationId: string;

  @ApiProperty()
  @IsString()
  purpose: string;

  @ApiProperty({ type: [VerificationClaimDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => VerificationClaimDto)
  claims: VerificationClaimDto[];
}
