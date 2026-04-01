import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class ApproveSellerOrderDto {
  @ApiPropertyOptional({ description: '판매자 메모' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  decisionMessage?: string;

  @ApiPropertyOptional({ description: '배송비 (승인 시 주문에 반영)' })
  @IsOptional()
  @IsString()
  shippingFee?: string;
}
