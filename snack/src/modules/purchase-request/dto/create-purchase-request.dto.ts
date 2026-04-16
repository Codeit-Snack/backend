import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';

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

  @ApiPropertyOptional({
    description: [
      '`true`이면 생성 직후 **자체 판매(구매자 조직 = 판매자 조직)** 라인만 자동 승인·구매 완료·지출까지 처리합니다.',
      '**권한:** ADMIN · SUPER_ADMIN. 타 조직 판매 상품이 섞이면 400.',
      '**예산:** UTC 현재 월 가용액이 (품목합 + 배송비×주문건수)보다 작으면 409.',
    ].join('\n'),
    example: false,
  })
  @IsOptional()
  @Transform(({ value }) => {
    if (value === true || value === 'true' || value === 1 || value === '1') {
      return true;
    }
    if (value === false || value === 'false' || value === 0 || value === '0') {
      return false;
    }
    return value;
  })
  @IsBoolean()
  instantCheckout?: boolean;

  @ApiPropertyOptional({
    description:
      '`instantCheckout` 시 각 판매자 주문(자체 판매 건)에 동일하게 적용할 배송비. Decimal 문자열, 생략 시 `"0"`.',
    example: '3000',
  })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  instantShippingFee?: string | null;
}
