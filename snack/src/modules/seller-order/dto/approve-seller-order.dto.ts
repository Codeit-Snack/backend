import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsNumber, IsOptional, Min } from 'class-validator';

export class ApproveSellerOrderDto {
  @ApiPropertyOptional({
    description: '배송비 (원). 승인 시 기록',
    example: 3000,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  shippingFee?: number;
}
