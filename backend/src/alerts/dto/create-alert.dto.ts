import { AlertType } from '@prisma/client';
import {
  IsEnum,
  IsIn,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
} from 'class-validator';

export class CreateAlertDto {
  @IsString()
  @IsNotEmpty()
  symbol!: string;

  @IsEnum(AlertType)
  @IsNotEmpty()
  alertType!: AlertType;

  @IsOptional()
  @IsNumber()
  @IsPositive()
  targetValue?: number;

  @IsOptional()
  @IsString()
  @IsIn(['10-K', '10-Q', '8-K'])
  secFormType?: string;
}
