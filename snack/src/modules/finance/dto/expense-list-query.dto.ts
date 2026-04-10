import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsISO8601, IsOptional, Max, Min } from 'class-validator';
import { ExpenseListSort } from '@/modules/finance/dto/expense-list-sort.enum';

export class ExpenseListQueryDto {
  @ApiPropertyOptional({ minimum: 1, default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ minimum: 1, maximum: 100, default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;

  @ApiPropertyOptional({ description: '시작 (포함), ISO 날짜' })
  @IsOptional()
  @IsISO8601()
  from?: string;

  @ApiPropertyOptional({ description: '종료 (포함), ISO 날짜' })
  @IsOptional()
  @IsISO8601()
  to?: string;

  @ApiPropertyOptional({
    enum: ExpenseListSort,
    default: ExpenseListSort.ExpensedAtDesc,
    description: '정렬: 지출일 내림차순(기본), 금액 오름/내림차순',
  })
  @IsOptional()
  @IsEnum(ExpenseListSort)
  sort?: ExpenseListSort;
}
