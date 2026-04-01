import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class RejectSellerOrderDto {
  @ApiPropertyOptional({ description: '거절 사유' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  decisionMessage?: string;

  /** API 편의용 별칭 (`decisionMessage`와 동일 용도) */
  @ApiPropertyOptional({ description: '거절 사유 (decisionMessage와 동일)' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  message?: string;
}
