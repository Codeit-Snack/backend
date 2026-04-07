import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
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
import { BudgetReservationService } from '@/modules/finance/services/budget-reservation.service';
import { CreateBudgetReservationDto } from '@/modules/finance/dto/create-budget-reservation.dto';

@ApiTags('Budget')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard)
@Controller('budget/reservations')
export class BudgetReservationController {
  constructor(
    private readonly budgetReservationService: BudgetReservationService,
  ) {}

  @Post()
  @ApiOperation({
    summary: '예산 예약 생성 (판매자 주문당 1건)',
    description: [
      '**권한:** ADMIN · SUPER_ADMIN',
      '',
      '**개념:** `budget_periods`는 “월 전체 상한”이고, `budget_reservations`는 특정 **판매자 주문(PO)** 에 묶어 “이만큼은 쓸 예정”이라고 **잠가 두는** 행입니다.',
      '월별 예산 upsert와 **별도 insert**이며, 한 PO당 ACTIVE 예약은 1건입니다.',
      '',
      '**잔액:** 서버가 **UTC 기준 “현재 연·월”**의 가용 잔액(`computeRemainingFunds`)과 비교합니다. 잔액이 부족하면 409.',
      '해당 UTC 월에 `budget_periods` 행이 없으면 자동 생성(B) 후 잔액을 계산합니다.',
      '',
      '`reservedAmount`를 생략하면 해당 PO의 `items_amount + shipping_fee`를 예약액으로 씁니다.',
    ].join('\n'),
  })
  @ApiResponse({ status: 201, description: '생성됨 (래퍼 `{ success, data }`)' })
  @ApiResponse({ status: 403, description: '비관리자' })
  @ApiResponse({ status: 409, description: '가용 예산 초과 등' })
  create(
    @OrganizationId() organizationId: number,
    @CurrentUser() user: JwtPayload,
    @Body() dto: CreateBudgetReservationDto,
  ) {
    return this.budgetReservationService.create(organizationId, user, dto);
  }

  @Post(':id/release')
  @ApiOperation({
    summary: '예산 예약 해제 (ACTIVE → RELEASED)',
    description:
      '**권한:** ADMIN · SUPER_ADMIN. ACTIVE 예약만 해제 가능. 잠긴 금액이 월 잔액에 다시 반영됩니다.',
  })
  @ApiResponse({ status: 200 })
  @ApiResponse({ status: 403, description: '비관리자' })
  @ApiResponse({ status: 404, description: '예약 없음' })
  release(
    @OrganizationId() organizationId: number,
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.budgetReservationService.release(organizationId, user, id);
  }

  @Get()
  @ApiOperation({
    summary: '예산 예약 목록',
    description:
      '**권한:** 로그인한 조직 멤버. `page`·`limit` 쿼리로 페이지네이션(기본 1, 20).',
  })
  @ApiResponse({ status: 200 })
  list(
    @OrganizationId() organizationId: number,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.budgetReservationService.list(
      organizationId,
      page ? parseInt(page, 10) : 1,
      limit ? parseInt(limit, 10) : 20,
    );
  }
}
