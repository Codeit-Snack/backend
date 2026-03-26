import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/** 장바구니 라인에 붙는 상품 요약 (products 테이블 컬럼만) */
export class CartProductSummaryDto {
  @ApiProperty({ example: 1 })
  id!: number;

  @ApiProperty({ example: 1 })
  organizationId!: number;

  @ApiPropertyOptional({ nullable: true })
  categoryId!: number | null;

  @ApiProperty()
  name!: string;

  @ApiProperty({ description: '가격 (Decimal 문자열)' })
  price!: string;

  @ApiPropertyOptional({ nullable: true })
  imageKey!: string | null;

  @ApiPropertyOptional({ nullable: true })
  productUrl!: string | null;

  @ApiProperty({ example: true })
  isActive!: boolean;
}

export class CartItemResponseDto {
  @ApiProperty({ example: 1 })
  id!: number;

  @ApiProperty({ example: 1 })
  productId!: number;

  @ApiProperty({ example: 2 })
  quantity!: number;

  @ApiProperty()
  createdAt!: string;

  @ApiProperty({ type: () => CartProductSummaryDto })
  product!: CartProductSummaryDto;
}

export class CartResponseDto {
  @ApiPropertyOptional({
    nullable: true,
    description: '카트가 없으면 null (아이템도 비어 있음)',
  })
  id!: number | null;

  @ApiProperty({ example: 1 })
  organizationId!: number;

  @ApiProperty({ example: 1 })
  userId!: number;

  @ApiPropertyOptional()
  createdAt!: string | null;

  @ApiPropertyOptional()
  updatedAt!: string | null;

  @ApiProperty({ type: [CartItemResponseDto] })
  items!: CartItemResponseDto[];
}
