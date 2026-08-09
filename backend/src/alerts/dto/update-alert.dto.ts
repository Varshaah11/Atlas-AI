import { AlertStatus } from '@prisma/client';
import { IsEnum, IsIn, IsNumber, IsOptional, IsPositive, IsString } from 'class-validator';

export class UpdateAlertDto {
  @IsOptional()
  @IsEnum(AlertStatus)
  status?: AlertStatus;

  @IsOptional()
  @IsNumber()
  @IsPositive()
  targetValue?: number;

  @IsOptional()
  @IsString()
  @IsIn(['10-K', '10-Q', '8-K'])
  secFormType?: string;
}
