import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Min } from 'class-validator';

export class CategoryListQueryDto {
  @ApiPropertyOptional({
    description: '부모 카테고리 ID 필터',
    example: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  parentId?: number | null;
}
