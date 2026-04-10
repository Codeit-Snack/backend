import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
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
import { BudgetPeriodService } from '@/modules/finance/services/budget-period.service';
import { UpsertBudgetPeriodDto } from '@/modules/finance/dto/upsert-budget-period.dto';
import { BudgetPeriodQueryDto } from '@/modules/finance/dto/budget-period-query.dto';
import { BudgetYearQueryDto } from '@/modules/finance/dto/budget-year-query.dto';

@ApiTags('Budget')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard)
@Controller('budget/periods')
export class BudgetPeriodController {
  constructor(private readonly budgetPeriodService: BudgetPeriodService) {}

  @Post()
  @ApiOperation({
    summary: '월별 예산 설정(upsert)',
    description: [
      '**권한:** SUPER_ADMIN',
      '',
      '선택한 `year`·`month`에 해당하는 `budget_periods` 행을 만들거나 `budgetAmount`로 덮어씁니다.',
      '이 호출로 저장된 행은 `created_by_user_id`가 채워지며, 이후 `hasPeriodConfigured`가 true로 취급됩니다.',
      '',
      '**화면과의 대응:** 피그마에서 “월별 예산 선택”으로 고른 달의 금액 입력란 → 이 API의 `budgetAmount`.',
      '“매달 시작 예산” 기본값은 `PATCH /budget/monthly-default`입니다.',
    ].join('\n'),
  })
  @ApiResponse({
    status: 201,
    description: '전역 래퍼 `{ success, data }` 적용 후 (Nest POST 기본 201)',
    schema: {
      example: {
        success: true,
        data: {
          id: 1,
          year: 2026,
          month: 3,
          budgetAmount: '2300000',
          hasPeriodConfigured: true,
          createdAt: '2026-03-01T00:00:00.000Z',
        },
      },
    },
  })
  @ApiResponse({ status: 403, description: 'SUPER_ADMIN 아님' })
  upsert(
    @OrganizationId() organizationId: number,
    @CurrentUser() user: JwtPayload,
    @Body() dto: UpsertBudgetPeriodDto,
  ) {
    return this.budgetPeriodService.upsert(organizationId, user, dto);
  }

  @Get('summary')
  @ApiOperation({
    summary: '예산 요약(설정액·지출·활성 예약·잔여)',
    description: [
      '**권한:** 로그인한 조직 멤버 누구나 (JWT `organizationId` = 구매자 조직).',
      '',
      '**집계 내용**',
      '- `budgetAmount`: 해당 월 예산 상한(문자열 Decimal)',
      '- `spentAmount`: 그 달 `expenses.expensed_at`(UTC 월 경계) 기준 지출 합',
      '- `reservedActiveAmount`: 아직 지출로 전환되지 않은 PO의 ACTIVE 예약 합',
      '- `remainingAmount`: 위 상한에서 지출·예약을 뺀 잔여(음수면 0으로 표시)',
      '',
      '**자동 생성:** 해당 연·월에 `budget_periods` 행이 없으면, 조직 `default_monthly_budget`으로 1행을 만든 뒤 집계합니다.',
      '',
      '**hasPeriodConfigured**',
      '- `true`: 그 달 행이 최고 관리자 `POST /budget/periods`로 한 번이라도 확정됨(`created_by_user_id` 존재)',
      '- `false`: 자동 생성만 된 상태(기본값만 반영, 최고 관리자가 “수정하기”로 확정 전)',
      '',
      '**참고:** 예산 예약 가능액 판단에도 동일한 잔액 로직(UTC 현재 월)이 쓰입니다.',
    ].join('\n'),
  })
  @ApiResponse({
    status: 200,
    schema: {
      example: {
        success: true,
        data: {
          year: 2026,
          month: 3,
          budgetAmount: '2300000',
          spentAmount: '100000',
          reservedActiveAmount: '50000',
          remainingAmount: '2150000',
          hasPeriodConfigured: true,
        },
      },
    },
  })
  summary(
    @OrganizationId() organizationId: number,
    @Query() q: BudgetPeriodQueryDto,
  ) {
    return this.budgetPeriodService.summary(organizationId, q.year, q.month);
  }

  @Get('by-year')
  @ApiOperation({
    summary: '특정 연도 월별 예산 목록',
    description: [
      '**권한:** 로그인한 조직 멤버.',
      '',
      'DB에 **실제로 존재하는** `budget_periods` 행만 반환합니다.',
      '아직 그 달을 조회·요약·예약 등으로 “건드리지 않은” 월은 목록에 없을 수 있습니다.',
      '달력 UI에서 빈 달은 `GET /budget/periods?year=&month=`로 단건 조회하면 자동 생성(B)됩니다.',
      '',
      '각 항목의 `hasPeriodConfigured`는 `POST /budget/periods` 확정 여부입니다.',
    ].join('\n'),
  })
  @ApiResponse({
    status: 200,
    schema: {
      example: {
        success: true,
        data: [
          {
            id: 1,
            year: 2026,
            month: 3,
            budgetAmount: '2300000',
            createdAt: '2026-03-01T00:00:00.000Z',
            hasPeriodConfigured: true,
          },
        ],
      },
    },
  })
  listYear(
    @OrganizationId() organizationId: number,
    @Query() q: BudgetYearQueryDto,
  ) {
    return this.budgetPeriodService.listByYear(organizationId, q.year);
  }

  @Get()
  @ApiOperation({
    summary: '단일 월 예산 조회',
    description: [
      '**권한:** 로그인한 조직 멤버.',
      '',
      '해당 연·월에 `budget_periods` 행이 없으면 `organizations.default_monthly_budget` 금액으로 **1행을 생성**한 뒤 반환합니다(자동 생성 B).',
      '',
      '`hasPeriodConfigured`: 최고 관리자가 `POST /budget/periods`로 저장한 적이 있으면 true, 자동 생성 직후만이면 false.',
    ].join('\n'),
  })
  @ApiResponse({
    status: 200,
    schema: {
      example: {
        success: true,
        data: {
          id: 1,
          year: 2026,
          month: 3,
          budgetAmount: '2000000',
          createdAt: '2026-03-15T12:00:00.000Z',
          hasPeriodConfigured: false,
        },
      },
    },
  })
  findOne(
    @OrganizationId() organizationId: number,
    @Query() q: BudgetPeriodQueryDto,
  ) {
    return this.budgetPeriodService.findOne(organizationId, q.year, q.month);
  }
}
