import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';
import { CurrentUser } from '@/auth/decorators/current-user.decorator';
import type { JwtPayload } from '@/common/types/jwt-payload.type';
import { OrganizationId } from '@/modules/catalog/decorators/catalog-context.decorator';
import { UpdateMonthlyBudgetDefaultDto } from '@/modules/finance/dto/update-monthly-budget-default.dto';
import { BudgetPeriodService } from '@/modules/finance/services/budget-period.service';

@ApiTags('Budget')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard)
@Controller('budget/monthly-default')
export class BudgetMonthlyDefaultController {
  constructor(private readonly budgetPeriodService: BudgetPeriodService) {}

  @Get()
  @ApiOperation({
    summary: '매달 시작 예산(조직 기본값) 조회',
    description: [
      '**권한:** SUPER_ADMIN',
      '',
      '조직 테이블 `organizations.default_monthly_budget` 값을 반환합니다(기본 0).',
      '',
      '**역할:** 아직 `budget_periods` 행이 없는 연·월을 **처음** 조회·요약·잔액 계산할 때, 이 금액으로 월별 행이 자동 생성됩니다.',
      '이미 만들어진 과거·현재 월의 `budgetAmount`는 바꾸지 않습니다. 달별 금액 변경은 `POST /budget/periods`.',
      '',
      '**화면:** 피그마 “매달 시작 예산” 입력란의 초기 로드에 사용.',
    ].join('\n'),
  })
  @ApiResponse({
    status: 200,
    schema: {
      example: {
        success: true,
        data: { defaultMonthlyBudget: '2000000' },
      },
    },
  })
  @ApiResponse({ status: 403, description: 'SUPER_ADMIN 아님' })
  getDefault(
    @OrganizationId() organizationId: number,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.budgetPeriodService.getMonthlyBudgetDefault(organizationId, user);
  }

  @Patch()
  @ApiOperation({
    summary: '매달 시작 예산(조직 기본값) 수정',
    description: [
      '**권한:** SUPER_ADMIN',
      '',
      '요청 본문의 `defaultMonthlyBudget`으로 조직 기본값을 갱신합니다.',
      '**이후** “행이 없는” 연·월을 처음 건드릴 때 자동 생성되는 금액에만 영향이 있습니다.',
      '',
      '관리자 화면에서 월별 금액과 기본값을 한 번에 저장할 경우, 프론트에서 `POST /budget/periods`와 이 API를 **둘 다** 호출하면 됩니다.',
    ].join('\n'),
  })
  @ApiResponse({
    status: 200,
    schema: {
      example: {
        success: true,
        data: { defaultMonthlyBudget: '2000000' },
      },
    },
  })
  @ApiResponse({ status: 403, description: 'SUPER_ADMIN 아님' })
  updateDefault(
    @OrganizationId() organizationId: number,
    @CurrentUser() user: JwtPayload,
    @Body() dto: UpdateMonthlyBudgetDefaultDto,
  ) {
    return this.budgetPeriodService.updateMonthlyBudgetDefault(
      organizationId,
      user,
      dto,
    );
  }
}
