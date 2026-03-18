import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
  Min,
} from 'class-validator';

/**
 * update 시: undefined = 필드 생략(변경 없음), null = 명시적 null 설정(예: categoryId 해제)
 */
export class UpdateProductDto {
  @ApiPropertyOptional({
    description: '카테고리 ID (null이면 카테고리 해제)',
    nullable: true,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  categoryId?: number | null;

  @ApiPropertyOptional({ description: '상품명', maxLength: 200 })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  name?: string;

  @ApiPropertyOptional({ description: '가격', minimum: 0 })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  price?: number;

  @ApiPropertyOptional({
    description: '이미지 키',
    maxLength: 512,
    nullable: true,
  })
  @IsOptional()
  @IsString()
  @MaxLength(512)
  imageKey?: string | null;

  @ApiPropertyOptional({ description: '상품 URL', nullable: true })
  @IsOptional()
  @IsString()
  @IsUrl()
  productUrl?: string | null;

  @ApiPropertyOptional({ description: '활성 여부 (soft delete 시 false)' })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
