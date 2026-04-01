import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateExpenseDto {
  @ApiProperty({ description: '판매자 주문 ID (구매자 조직 소유)' })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  purchaseOrderId!: number;

  @ApiProperty({ description: '상품 합계', example: 24000 })
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  itemsAmount!: number;

  @ApiPropertyOptional({ description: '배송비', default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  shippingAmount?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  note?: string;
}
