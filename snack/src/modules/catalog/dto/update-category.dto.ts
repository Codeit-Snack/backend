import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

export class UpdateCategoryDto {
  @ApiPropertyOptional({
    description: '부모 카테고리 ID (null이면 최상위)',
    nullable: true,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  parentId?: number | null;

  @ApiPropertyOptional({ description: '카테고리명', maxLength: 120 })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  name?: string;

  @ApiPropertyOptional({ description: '정렬 순서', minimum: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;

  @ApiPropertyOptional({ description: '활성 여부' })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
