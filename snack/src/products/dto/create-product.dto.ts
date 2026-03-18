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

export class CreateProductDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  categoryId?: number | null;

  @IsString()
  @MaxLength(200)
  name!: string;

  @IsNumber()
  @Min(0)
  price!: number;

  @IsOptional()
  @IsString()
  @MaxLength(512)
  imageKey?: string | null;

  @IsOptional()
  @IsUrl()
  productUrl?: string | null;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
