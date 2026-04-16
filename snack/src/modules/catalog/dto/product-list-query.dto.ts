import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';
import { ProductListSort } from './product-list-sort.enum';

export class ProductListQueryDto {
  @ApiPropertyOptional({
    description: '조직 ID (필수, 컨텍스트에서 주입)',
    example: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  organizationId?: number;

  @ApiPropertyOptional({
    description:
      '카테고리 ID 정확 일치 필터. `parentCategoryId`와 함께 쓰면 교집합(하위 트리 안의 해당 카테고리만).',
    example: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  categoryId?: number;

  @ApiPropertyOptional({
    description:
      '상위(또는 임의) 카테고리 ID — 해당 카테고리와 모든 하위 카테고리에 속한 상품만 조회',
    example: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  parentCategoryId?: number;

  @ApiPropertyOptional({
    description:
      '`true`이면 내가 등록한 상품만 (`createdByUserId` = 현재 사용자). `true`/`1`/`"true"` 허용',
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
  mine?: boolean;

  @ApiPropertyOptional({
    enum: ProductListSort,
    default: ProductListSort.CreatedAtDesc,
    description: '정렬 기준',
  })
  @IsOptional()
  @IsEnum(ProductListSort)
  sort?: ProductListSort;

  @ApiPropertyOptional({
    description: '활성 여부 필터 (true/false, 미전달 시 전체)',
    example: true,
  })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({
    description: '상품명 검색 (LIKE)',
    example: '콜라',
  })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  keyword?: string;

  @ApiPropertyOptional({
    description: '페이지 번호 (1부터)',
    default: 1,
    minimum: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ description: '페이지 크기', default: 10, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number = 10;
}
