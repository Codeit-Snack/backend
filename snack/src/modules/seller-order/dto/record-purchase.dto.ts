import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { purchase_orders_platform } from '@prisma/client';
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';

export class RecordPurchaseDto {
  @ApiProperty({ enum: purchase_orders_platform })
  @IsEnum(purchase_orders_platform)
  platform: purchase_orders_platform;

  @ApiPropertyOptional({ description: '외부 쇼핑몰 주문번호' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  externalOrderNo?: string;

  @ApiPropertyOptional({ description: '외부 주문 상세 URL' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  orderUrl?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  note?: string;
}
