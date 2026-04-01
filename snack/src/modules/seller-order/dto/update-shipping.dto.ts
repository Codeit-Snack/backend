import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateShippingDto {
  @ApiPropertyOptional({ example: 'DELIVERED' })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  shippingStatus?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  deliveredAt?: string;
}
