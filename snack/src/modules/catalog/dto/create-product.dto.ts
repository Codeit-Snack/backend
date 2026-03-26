import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
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

/** organizationId는 컨텍스트에서 주입 */
export class CreateProductDto {
  @ApiPropertyOptional({
    description: '카테고리 ID (미지정 시 null)',
    nullable: true,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  categoryId?: number | null;

  @ApiProperty({ description: '상품명', maxLength: 200, example: '콜라 500ml' })
  @IsString()
  @MaxLength(200)
  name!: string;

  @ApiProperty({ description: '가격', minimum: 0, example: 1500 })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  price!: number;

  @ApiPropertyOptional({ description: '이미지 키', maxLength: 512 })
  @IsOptional()
  @IsString()
  @MaxLength(512)
  imageKey?: string | null;

  @ApiPropertyOptional({ description: '상품 URL' })
  @IsOptional()
  @IsString()
  @IsUrl()
  productUrl?: string | null;

  @ApiPropertyOptional({ description: '활성 여부', default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean = true;
}
