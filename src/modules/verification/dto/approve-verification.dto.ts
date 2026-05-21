import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { CredentialType } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  ValidateNested,
} from 'class-validator';
import { VerificationClaimDto } from './verification-claim.dto';

export class ApproveVerificationDto {
  @ApiProperty()
  @IsUUID()
  verificationRequestId: string;

  @ApiProperty({ enum: CredentialType })
  @IsEnum(CredentialType)
  credentialType: CredentialType;

  @ApiProperty({ type: [VerificationClaimDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => VerificationClaimDto)
  approvedClaims: VerificationClaimDto[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  expiresAt?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  reason?: string;
}
