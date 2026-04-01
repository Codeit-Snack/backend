import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { CategoryResponseDto } from '@/modules/catalog/dto/category-response.dto';

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
    description: '상세 조회 시에만 포함',
    type: () => CategoryResponseDto,
    nullable: true,
  })
  category?: CategoryResponseDto | null;
}
