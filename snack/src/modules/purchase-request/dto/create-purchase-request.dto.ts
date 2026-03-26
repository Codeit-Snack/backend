import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

/** 장바구니 내용을 스냅샷으로 옮겨 생성 (body는 메시지 등 선택) */
export class CreatePurchaseRequestDto {
  @ApiPropertyOptional({
    description: '구매 요청 메시지',
    maxLength: 5000,
  })
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  requestMessage?: string | null;
}
