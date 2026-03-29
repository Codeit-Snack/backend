import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class RejectSellerOrderDto {
  @ApiPropertyOptional({ description: '거절 사유' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  message?: string;
}
