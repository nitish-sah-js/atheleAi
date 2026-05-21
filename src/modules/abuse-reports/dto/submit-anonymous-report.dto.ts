import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsUUID, MinLength } from 'class-validator';

export class SubmitAnonymousReportDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  title?: string;

  @ApiProperty()
  @IsString()
  @MinLength(20)
  narrative: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  subjectAthleteId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  reporterContact?: string;
}
