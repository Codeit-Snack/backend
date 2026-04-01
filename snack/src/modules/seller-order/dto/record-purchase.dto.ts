import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { purchase_orders_platform } from '@prisma/client';
import {
  IsEnum,
  IsNumberString,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class RecordPurchaseDto {
  @ApiProperty({ enum: purchase_orders_platform })
  @IsEnum(purchase_orders_platform)
  platform!: purchase_orders_platform;

  @ApiPropertyOptional({ maxLength: 100 })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  externalOrderNo?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  orderUrl?: string;

  @ApiPropertyOptional({ description: '배송비 (소수 문자열)' })
  @IsOptional()
  @IsNumberString()
  @MaxLength(20)
  shippingFee?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  note?: string;
}
