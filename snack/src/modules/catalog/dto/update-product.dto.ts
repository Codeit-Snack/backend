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

export class UpdateProductDto {
  @ApiPropertyOptional({
    description: '카테고리 ID (null이면 해제)',
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

  @ApiPropertyOptional({ description: '활성 여부' })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
