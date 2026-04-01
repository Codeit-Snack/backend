import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class ApproveSellerOrderDto {
  @ApiPropertyOptional({ description: '판매자 메모' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  decisionMessage?: string;
}
