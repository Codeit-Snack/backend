import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';
import { CurrentUser } from '@/auth/decorators/current-user.decorator';
import type { JwtPayload } from '@/common/types/jwt-payload.type';
import { OrganizationId } from '@/modules/catalog/decorators/catalog-context.decorator';
import { ExpenseService } from '@/modules/finance/services/expense.service';
import { CreateExpenseDto } from '@/modules/finance/dto/create-expense.dto';
import { ExpenseListQueryDto } from '@/modules/finance/dto/expense-list-query.dto';

@ApiTags('Expenses')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard)
@Controller('expenses')
export class ExpenseController {
  constructor(private readonly expenseService: ExpenseService) {}

  @Post()
  @ApiOperation({
    summary: '지출 기록 생성',
    description: '주문당 1건. ACTIVE 예산 예약이 있으면 자동으로 CONSUMED 처리',
  })
  create(
    @OrganizationId() organizationId: number,
    @CurrentUser() user: JwtPayload,
    @Body() dto: CreateExpenseDto,
  ) {
    return this.expenseService.create(organizationId, user, dto);
  }

  @Get()
  @ApiOperation({ summary: '지출 목록' })
  list(
    @OrganizationId() organizationId: number,
    @Query() query: ExpenseListQueryDto,
  ) {
    return this.expenseService.list(organizationId, query);
  }
}
