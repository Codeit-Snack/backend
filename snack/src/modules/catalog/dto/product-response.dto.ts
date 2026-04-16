import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { CategoryResponseDto } from './category-response.dto';

/** Decimal(price) 직렬화: 문자열로 노출하여 정확도 유지 */
export class ProductResponseDto {
  @ApiProperty({ example: 1 })
  id!: number;

  @ApiProperty({ example: 1 })
  organizationId!: number;

  @ApiPropertyOptional({ nullable: true, example: 1 })
  categoryId!: number | null;

  @ApiProperty({ example: '콜라 500ml' })
  name!: string;

  @ApiProperty({
    description: '가격 (Decimal 직렬화용 문자열)',
    example: '1500.00',
  })
  price!: string;

  @ApiPropertyOptional({ nullable: true })
  imageKey!: string | null;

  @ApiPropertyOptional({ nullable: true })
  productUrl!: string | null;

  @ApiProperty({ example: 0 })
  purchaseCountCache!: number;

  @ApiPropertyOptional({ nullable: true })
  createdByUserId!: number | null;

  @ApiProperty({ example: true })
  isActive!: boolean;

  @ApiProperty()
  createdAt!: string;

  @ApiProperty()
  updatedAt!: string;

  @ApiPropertyOptional({
    description:
      '목록·상세 모두에서 채워질 수 있음 (목록은 `include category` 시)',
    type: () => CategoryResponseDto,
    nullable: true,
  })
  category?: CategoryResponseDto | null;
}
