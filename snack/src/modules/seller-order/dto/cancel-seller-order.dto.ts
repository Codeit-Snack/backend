import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class CancelSellerOrderDto {
  @ApiPropertyOptional({ description: '취소 사유' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  message?: string;
}
