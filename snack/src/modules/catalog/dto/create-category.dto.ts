import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateCategoryDto {
  @ApiPropertyOptional({
    description: '부모 카테고리 ID (최상위면 생략)',
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  parentId?: number | null;

  @ApiProperty({ description: '카테고리명', maxLength: 120, example: '음료' })
  @IsString()
  @MaxLength(120)
  name!: string;

  @ApiPropertyOptional({
    description: '정렬 순서 (기본 0)',
    default: 0,
    minimum: 0,
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number = 0;

  @ApiPropertyOptional({
    description: '활성 여부',
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean = true;
}
