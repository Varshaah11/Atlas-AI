import { BriefingFrequency } from '@prisma/client';
import { IsArray, IsBoolean, IsEnum, IsOptional, IsString, Matches } from 'class-validator';

export class UpdateBriefingConfigDto {
  @IsOptional()
  @IsEnum(BriefingFrequency)
  frequency?: BriefingFrequency;

  @IsOptional()
  @IsString()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, {
    message: 'preferredTime must be a valid 24-hour time string in HH:mm format (e.g. "08:00")',
  })
  preferredTime?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  symbols?: string[];

  @IsOptional()
  @IsBoolean()
  includeNews?: boolean;

  @IsOptional()
  @IsBoolean()
  includeSec?: boolean;

  @IsOptional()
  @IsBoolean()
  deliverTelegram?: boolean;

  @IsOptional()
  @IsBoolean()
  enabled?: boolean;
}
