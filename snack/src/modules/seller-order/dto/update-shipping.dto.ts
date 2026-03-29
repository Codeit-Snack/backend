import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsISO8601, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateShippingDto {
  @ApiProperty({ example: 'SHIPPED', description: '배송 상태 라벨' })
  @IsString()
  @MaxLength(40)
  shippingStatus: string;

  @ApiPropertyOptional({ description: '배송 완료 시각 (ISO 8601)' })
  @IsOptional()
  @IsISO8601()
  deliveredAt?: string;
}
