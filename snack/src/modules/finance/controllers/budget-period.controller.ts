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
  @ApiOperation({ summary: '월별 예산 설정(upsert)' })
  @ApiResponse({ status: 200, description: '저장됨' })
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
    description:
      '해당 월 expensed_at 기준 지출 합계, 지출 미발생 PO에 대한 ACTIVE 예약 합계를 차감한 잔여',
  })
  summary(
    @OrganizationId() organizationId: number,
    @Query() q: BudgetPeriodQueryDto,
  ) {
    return this.budgetPeriodService.summary(organizationId, q.year, q.month);
  }

  @Get('by-year')
  @ApiOperation({ summary: '특정 연도 월별 예산 목록' })
  listYear(
    @OrganizationId() organizationId: number,
    @Query() q: BudgetYearQueryDto,
  ) {
    return this.budgetPeriodService.listByYear(organizationId, q.year);
  }

  @Get()
  @ApiOperation({ summary: '단일 월 예산 조회 (없으면 null)' })
  @ApiResponse({ status: 200 })
  findOne(
    @OrganizationId() organizationId: number,
    @Query() q: BudgetPeriodQueryDto,
  ) {
    return this.budgetPeriodService.findOne(organizationId, q.year, q.month);
  }
}
