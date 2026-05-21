import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ArrayMaxSize, IsArray, IsInt, IsOptional, IsString, IsUUID, Min } from 'class-validator';

export class SignCredentialDto {
  @ApiProperty()
  @IsUUID()
  credentialId: string;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(25)
  @IsString({ each: true })
  allowedClaims?: string[];

  @ApiPropertyOptional({ default: 86400 })
  @IsOptional()
  @IsInt()
  @Min(60)
  expiresInSeconds?: number;
}
