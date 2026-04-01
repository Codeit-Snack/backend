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
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
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
  @ApiOperation({ summary: '예산 예약 생성 (판매자 주문당 1건)' })
  create(
    @OrganizationId() organizationId: number,
    @CurrentUser() user: JwtPayload,
    @Body() dto: CreateBudgetReservationDto,
  ) {
    return this.budgetReservationService.create(organizationId, user, dto);
  }

  @Post(':id/release')
  @ApiOperation({ summary: '예산 예약 해제 (ACTIVE → RELEASED)' })
  release(
    @OrganizationId() organizationId: number,
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.budgetReservationService.release(organizationId, user, id);
  }

  @Get()
  @ApiOperation({ summary: '예산 예약 목록' })
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
