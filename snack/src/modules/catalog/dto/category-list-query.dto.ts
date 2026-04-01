import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Min } from 'class-validator';

export class CategoryListQueryDto {
  @ApiPropertyOptional({
    description:
      '부모 카테고리 ID (null/미전달: 전체, 특정 값: 해당 부모의 자식만)',
    example: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  parentId?: number | null;
}
