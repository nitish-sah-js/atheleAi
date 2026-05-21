import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ClaimVisibility } from '@prisma/client';
import { IsEnum, IsOptional, IsString, IsUUID } from 'class-validator';

export class VerificationClaimDto {
  @ApiProperty()
  @IsString()
  claimKey: string;

  @ApiPropertyOptional()
  @IsOptional()
  claimValue?: unknown;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  evidenceDocumentId?: string;

  @ApiPropertyOptional({ enum: ClaimVisibility })
  @IsOptional()
  @IsEnum(ClaimVisibility)
  visibility?: ClaimVisibility;
}
