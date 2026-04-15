import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, Max, Min } from 'class-validator';

export class UpdateMonthlyBudgetDefaultDto {
  @ApiProperty({
    description: [
      '조직 “매달 시작 예산”(organizations.default_monthly_budget).',
      '아직 budget_periods 행이 없는 연·월을 처음 조회·요약·잔액 계산할 때 이 금액으로 행이 생김.',
      '0이면 자동 생성 시에도 0원부터 시작.',
    ].join(' '),
    example: 2_000_000,
    minimum: 0,
  })
  @IsNumber()
  @Min(0)
  @Max(999_999_999_999.99)
  defaultMonthlyBudget!: number;
}
