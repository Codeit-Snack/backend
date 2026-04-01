import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsNumber, IsOptional, Min } from 'class-validator';

export class CreateBudgetReservationDto {
  @ApiProperty({ description: '구매자 기준 판매자 주문 ID' })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  purchaseOrderId!: number;

  @ApiPropertyOptional({
    description:
      '미입력 시 해당 주문의 items_amount + shipping_fee 합계로 예약',
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  reservedAmount?: number;
}
