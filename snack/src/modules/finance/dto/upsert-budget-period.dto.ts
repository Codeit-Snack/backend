import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsNumber, Max, Min } from 'class-validator';

export class UpsertBudgetPeriodDto {
  @ApiProperty({ example: 2026, minimum: 2000, maximum: 2100 })
  @Type(() => Number)
  @IsInt()
  @Min(2000)
  @Max(2100)
  year!: number;

  @ApiProperty({ example: 3, minimum: 1, maximum: 12 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(12)
  month!: number;

  @ApiProperty({
    description:
      '해당 연·월의 예산 상한(원). 관리자가 확정하는 값으로, `POST /budget/periods` 저장 시 `hasPeriodConfigured`가 true가 됨.',
    example: 2_300_000,
  })
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  budgetAmount!: number;
}
